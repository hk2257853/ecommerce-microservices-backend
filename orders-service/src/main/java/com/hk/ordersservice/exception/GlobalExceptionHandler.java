package com.hk.ordersservice.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.transaction.TransactionTimedOutException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidationExceptions(MethodArgumentNotValidException ex) {
    Map<String, String> errors = new HashMap<>();
    ex.getBindingResult().getAllErrors().forEach((error) -> {
      String fieldName = ((FieldError) error).getField();
      String errorMessage = error.getDefaultMessage();
      errors.put(fieldName, errorMessage);
    });

    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.BAD_REQUEST.value(),
        "Validation failed",
        errors,
        LocalDateTime.now());

    logger.warn("Validation failed with {} field errors: {}", errors.size(), errors);
    return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
  }

  // GlobalExceptionHandler catches it by type and decides what HTTP response to
  // return. Without the custom class, you can't have a specific @ExceptionHandler
  // for it (specific message and status code).
  // so in my service i throw ResourceNotFoundException, and here it catches it
  // and returns a 404
  @ExceptionHandler(ResourceNotFoundException.class)
  public ResponseEntity<ErrorResponse> handleResourceNotFoundException(ResourceNotFoundException ex) {
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.NOT_FOUND.value(),
        ex.getMessage(),
        null,
        LocalDateTime.now());

    logger.warn("Resource not found exception: {}", ex.getMessage());
    return new ResponseEntity<>(errorResponse, HttpStatus.NOT_FOUND);
  }

  @ExceptionHandler(DuplicateResourceException.class)
  public ResponseEntity<ErrorResponse> handleDuplicateResourceException(DuplicateResourceException ex) {
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.CONFLICT.value(),
        ex.getMessage(),
        null,
        LocalDateTime.now());

    logger.warn("Duplicate resource exception: {}", ex.getMessage());
    return new ResponseEntity<>(errorResponse, HttpStatus.CONFLICT);
  }

  @ExceptionHandler(BusinessRuleException.class)
  public ResponseEntity<ErrorResponse> handleBusinessRuleException(BusinessRuleException ex) {
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.BAD_REQUEST.value(),
        ex.getMessage(),
        null,
        LocalDateTime.now());

    logger.warn("Business rule exception: {}", ex.getMessage());
    return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
  }

  @ExceptionHandler(InsufficientStockException.class)
  public ResponseEntity<ErrorResponse> handleInsufficientStockException(InsufficientStockException ex) {
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.BAD_REQUEST.value(),
        ex.getMessage(),
        null,
        LocalDateTime.now());

    logger.warn("Insufficient stock exception: {}", ex.getMessage());
    return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
  }

  @ExceptionHandler(IdempotencyKeyExistsException.class)
  public ResponseEntity<ErrorResponse> handleIdempotencyKeyExistsException(IdempotencyKeyExistsException ex) {
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.CONFLICT.value(),
        ex.getMessage(),
        null,
        LocalDateTime.now());

    logger.warn("Idempotency key conflict: {}", ex.getMessage());
    return new ResponseEntity<>(errorResponse, HttpStatus.CONFLICT);
  }

  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  public ResponseEntity<ErrorResponse> handleOptimisticLockingFailureException(
      ObjectOptimisticLockingFailureException ex) {
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.CONFLICT.value(),
        "The resource was modified by another transaction. Please try again.",
        null,
        LocalDateTime.now());

    logger.warn("Optimistic locking failure: {}", ex.getMessage());
    return new ResponseEntity<>(errorResponse, HttpStatus.CONFLICT);
  }

  @ExceptionHandler({
      CannotGetJdbcConnectionException.class,
      CannotCreateTransactionException.class,
      TransactionSystemException.class,
      JpaSystemException.class,
      QueryTimeoutException.class,
      TransactionTimedOutException.class,
      DataAccessResourceFailureException.class
  })
  public ResponseEntity<ErrorResponse> handleDatabaseUnavailable(Exception ex) {
    logger.warn("Database unavailable or timed out: {}", ex.getMessage());
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.SERVICE_UNAVAILABLE.value(),
        "Service temporarily unavailable. Please retry shortly.",
        null,
        LocalDateTime.now());

    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .header(HttpHeaders.RETRY_AFTER, "2")
        .body(errorResponse);
  }

  @ExceptionHandler(RuntimeException.class)
  public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException ex) {
    logger.error("Runtime exception occurred: {}", ex.getMessage(), ex);
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.INTERNAL_SERVER_ERROR.value(),
        "Runtime error occurred",
        null,
        LocalDateTime.now());

    return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
    logger.error("Unexpected exception occurred: {}", ex.getMessage(), ex);
    ErrorResponse errorResponse = new ErrorResponse(
        HttpStatus.INTERNAL_SERVER_ERROR.value(),
        "Internal server error",
        null,
        LocalDateTime.now());

    return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private record ErrorResponse(
      int status,
      String message,
      Map<String, String> errors,
      LocalDateTime timestamp) {
  }
}

/*
 * Global Exception Handler Notes:
 * 
 * - @RestControllerAdvice:
 * - Applies to all controllers globally
 * - Combines @ControllerAdvice + @ResponseBody
 * - Used for centralized exception handling (no try-catch in controllers)
 * 
 * - @ExceptionHandler:
 * - Handles specific exception types
 * - Maps exception → custom HTTP response
 * 
 * - MethodArgumentNotValidException:
 * - Triggered when @Valid validation fails
 * - Extracts field-level errors using BindingResult
 * - Returns structured validation error response (field → message)
 * 
 * - RuntimeException:
 * - Handles application-level errors (e.g., resource not found)
 * - Can be replaced with custom exceptions for better design
 * 
 * - Exception (generic):
 * - Catch-all fallback handler
 * - Prevents exposing internal errors to client
 * - Returns 500 Internal Server Error
 * 
 * - ErrorResponse:
 * - DTO for consistent error responses
 * - Contains status, message, errors map, timestamp
 * 
 * - Benefits:
 * - Centralized error handling
 * - Cleaner controllers
 * - Consistent API responses
 * - Better client experience
 * 
 * - Notes:
 * - Prefer custom exceptions over generic RuntimeException
 * - Order matters → specific handlers first, generic last
 */