#include <napi.h>
#include <cmath>
#include <algorithm>

constexpr int kHistoryStride = 7;   // t, x, y, z, dx, dy, dz
constexpr int kPoseComponents = 6;  // x, y, z, dx, dy, dz

// Native C++ Point-to-Segment Distance Squared Math
double distSqPointToSegment(double px, double py, double pz,
                            double ax, double ay, double az,
                            double bx, double by, double bz) {
    double abx = bx - ax;
    double aby = by - ay;
    double abz = bz - az;

    double apx = px - ax;
    double apy = py - ay;
    double apz = pz - az;

    double abLenSq = abx * abx + aby * aby + abz * abz;
    if (abLenSq == 0.0) {
        return apx * apx + apy * apy + apz * apz;
    }

    double t = (apx * abx + apy * aby + apz * abz) / abLenSq;
    t = std::max(0.0, std::min(1.0, t)); // Clamp t between 0 and 1

    double cx = ax + abx * t;
    double cy = ay + aby * t;
    double cz = az + abz * t;

    double dx = px - cx;
    double dy = py - cy;
    double dz = pz - cz;

    return dx * dx + dy * dy + dz * dz;
}

// Helper to get a value from the flat buffer
double getVal(const Napi::Float64Array& hist, int sampleIndex, int offset) {
    return hist[sampleIndex * kHistoryStride + offset];
}

// Native Lerp
double lerp(double a, double b, double t) {
    return a + (b - a) * t;
}

// The Native Lag Compensator
void SamplePlayerAt(const Napi::Float64Array& hist, int head, int count, double targetTime, double* outPose) {
    int maxSamples = static_cast<int>(hist.ElementLength() / kHistoryStride);
    if (maxSamples <= 0) return;

    count = std::max(0, std::min(count, maxSamples));
    if (count == 0) return; // No history to sample

    // Defensive normalization in case JS sends values out of range.
    head = ((head % maxSamples) + maxSamples) % maxSamples;

    // Start looking at the most recently written sample
    int newestIdx = (head - 1 + maxSamples) % maxSamples;
    
    // If the target time is newer than our newest sample, just return the newest
    if (targetTime >= getVal(hist, newestIdx, 0)) {
        for(int i=0; i<kPoseComponents; i++) outPose[i] = getVal(hist, newestIdx, i+1);
        return;
    }

    // Traverse backwards through the circular buffer
    for (int i = 0; i < count - 1; i++) {
        int idxB = (newestIdx - i + maxSamples) % maxSamples;
        int idxA = (idxB - 1 + maxSamples) % maxSamples;

        double tB = getVal(hist, idxB, 0);
        double tA = getVal(hist, idxA, 0);

        // Did we find the window?
        if (targetTime >= tA && targetTime <= tB) {
            double span = tB - tA;
            double t = (span == 0.0) ? 0.0 : (targetTime - tA) / span;

            // Lerp X, Y, Z, RX, RY, RZ
            for(int j=0; j<kPoseComponents; j++) {
                double valA = getVal(hist, idxA, j+1);
                double valB = getVal(hist, idxB, j+1);
                outPose[j] = lerp(valA, valB, t);
            }
            return;
        }
    }

    // If we asked for a time older than our history, return the oldest known sample
    int oldestIdx = (newestIdx - count + 1 + maxSamples) % maxSamples;
    for(int i=0; i<kPoseComponents; i++) outPose[i] = getVal(hist, oldestIdx, i+1);
}

// The function exposed to JavaScript
Napi::Value CheckHit(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 10) {
        Napi::TypeError::New(env, "checkHit expects 10 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array ||
        !info[3].IsTypedArray() ||
        info[3].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
        Napi::TypeError::New(env, "shooterHist and targetHist must be Float64Array").ThrowAsJavaScriptException();
        return env.Null();
    }

    for (int i : {1, 2, 4, 5, 6, 7, 8, 9}) {
        if (!info[i].IsNumber()) {
            Napi::TypeError::New(env, "head/count/time/combat arguments must be numbers").ThrowAsJavaScriptException();
            return env.Null();
        }
    }

    // 1. Grab Shooter Data
    Napi::Float64Array shooterHist = info[0].As<Napi::Float64Array>();
    int shooterHead = info[1].As<Napi::Number>().Int32Value();
    int shooterCount = info[2].As<Napi::Number>().Int32Value();

    // 2. Grab Target Data
    Napi::Float64Array targetHist = info[3].As<Napi::Float64Array>();
    int targetHead = info[4].As<Napi::Number>().Int32Value();
    int targetCount = info[5].As<Napi::Number>().Int32Value();

    // Without history samples, interpolation would default to zeroed poses and create false hits.
    if (shooterCount <= 0 || targetCount <= 0) {
        return Napi::Boolean::New(env, false);
    }

    // 3. Grab Combat Vars
    double targetTime = info[6].As<Napi::Number>().DoubleValue();
    double muzzleOffset = info[7].As<Napi::Number>().DoubleValue();
    double laserRange = info[8].As<Napi::Number>().DoubleValue();
    double hitRadius = info[9].As<Napi::Number>().DoubleValue();

    if (!std::isfinite(targetTime) ||
        !std::isfinite(muzzleOffset) ||
        !std::isfinite(laserRange) ||
        !std::isfinite(hitRadius) ||
        laserRange <= 0.0 ||
        hitRadius <= 0.0) {
        Napi::TypeError::New(env, "Invalid numeric arguments for checkHit").ThrowAsJavaScriptException();
        return env.Null();
    }

// 4. Interpolate both ships natively
    double shooterPose[6] = {0};
    double targetPose[6] = {0};

    SamplePlayerAt(shooterHist, shooterHead, shooterCount, targetTime, shooterPose);
    SamplePlayerAt(targetHist, targetHead, targetCount, targetTime, targetPose);

    // Shooter Pose (x, y, z) and Forward Vector (dx, dy, dz)
    double sx = shooterPose[0], sy = shooterPose[1], sz = shooterPose[2];
    double dirX = shooterPose[3], dirY = shooterPose[4], dirZ = shooterPose[5];

    // Target Pose
    double tx = targetPose[0], ty = targetPose[1], tz = targetPose[2];

    // Normalize the vector just in case
    double len = sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ);
    if(len > 0) { dirX/=len; dirY/=len; dirZ/=len; }

    // 6. Setup Laser Segment using the raw vector
    double segAx = sx + dirX * muzzleOffset;
    double segAy = sy + dirY * muzzleOffset;
    double segAz = sz + dirZ * muzzleOffset;

    double segBx = segAx + dirX * laserRange;
    double segBy = segAy + dirY * laserRange;
    double segBz = segAz + dirZ * laserRange;

    // 7. Calculate Hit
    double distSq = distSqPointToSegment(tx, ty, tz, segAx, segAy, segAz, segBx, segBy, segBz);
    bool isHit = distSq <= (hitRadius * hitRadius);
    
    return Napi::Boolean::New(env, isHit);
}


// Register the module
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "checkHit"), Napi::Function::New(env, CheckHit));
    return exports;
}

NODE_API_MODULE(combat, Init)
