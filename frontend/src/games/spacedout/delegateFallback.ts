export type Delegate = "GPU" | "CPU";

// Tries the GPU delegate first and falls back to CPU (machines without WebGL).
// If both fail, the CPU error is the one worth reporting.
export async function createWithDelegateFallback<T>(
  create: (delegate: Delegate) => T | Promise<T>,
): Promise<{ value: T; delegate: Delegate }> {
  try {
    return { value: await create("GPU"), delegate: "GPU" };
  } catch {
    return { value: await create("CPU"), delegate: "CPU" };
  }
}
