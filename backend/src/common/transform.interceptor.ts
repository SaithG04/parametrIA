import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { API_MESSAGE } from "./api-message.decorator";

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const message = Reflect.getMetadata(API_MESSAGE, context.getHandler()) ??
      Reflect.getMetadata(API_MESSAGE, context.getClass()) ??
      "Operación completada.";
    return next.handle().pipe(
      map((data) => ({ success: true, message, data, errors: null })),
    );
  }
}
