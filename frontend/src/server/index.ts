// src/server/index.ts
export * from "../shared/Vector3";
export * from "../shared/strings";
export * from "../shared/types";
export * from "../shared/utils";

// REMOVE THIS LINE: export * from "./server";  <-- CAUSES LOOP

export * from "./elements/ServerBall";
export * from "./elements/ServerMagicBall";
export * from "./elements/ServerPaddle";