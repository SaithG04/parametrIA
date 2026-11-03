import { SetMetadata } from "@nestjs/common";

export const API_MESSAGE = "api:message";

export const ApiMessage = (message: string) => SetMetadata(API_MESSAGE, message);
