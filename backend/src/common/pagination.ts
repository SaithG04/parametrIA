import { BadRequestException } from "@nestjs/common";

export interface PaginationOptions {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function parsePagination(page?: string, pageSize?: string): PaginationOptions {
  const parsedPage = page === undefined ? 1 : Number(page);
  const parsedSize = pageSize === undefined ? 10 : Number(pageSize);
  if (!Number.isSafeInteger(parsedPage) || parsedPage < 1 ||
      !Number.isSafeInteger(parsedSize) || parsedSize < 1 || parsedSize > 100) {
    throw new BadRequestException({
      message: "La página debe ser positiva y pageSize debe estar entre 1 y 100.",
      errors: ["INVALID_PAGINATION"],
    });
  }
  return {
    page: parsedPage,
    pageSize: parsedSize,
    skip: (parsedPage - 1) * parsedSize,
    take: parsedSize,
  };
}

export function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResult<T> {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
