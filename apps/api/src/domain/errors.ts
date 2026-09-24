export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export type FieldError = {
  field: string;
  message: string;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: readonly FieldError[];

  constructor({
    code,
    status,
    message,
    details = [],
  }: {
    code: ErrorCode;
    status: number;
    message: string;
    details?: readonly FieldError[];
  }) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: readonly FieldError[]) {
    super({
      code: "VALIDATION_ERROR",
      status: 400,
      message,
      details,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super({
      code: "NOT_FOUND",
      status: 404,
      message,
    });
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(message: string) {
    super({
      code: "METHOD_NOT_ALLOWED",
      status: 405,
      message,
    });
  }
}

export class InternalError extends AppError {
  constructor(message: string) {
    super({
      code: "INTERNAL_ERROR",
      status: 500,
      message,
    });
  }
}
