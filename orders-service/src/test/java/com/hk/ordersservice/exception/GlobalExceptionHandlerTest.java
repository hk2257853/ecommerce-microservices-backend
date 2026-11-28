package com.hk.ordersservice.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.transaction.TransactionTimedOutException;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void handleDatabaseUnavailableReturns503WithRetryAfterForAllTransientDbExceptions() {
    Exception[] exceptions = {
        new CannotGetJdbcConnectionException("pool exhausted"),
        new CannotCreateTransactionException("Could not open JPA EntityManager for transaction"),
        new TransactionSystemException("Could not commit JPA transaction"),
        new JpaSystemException(new RuntimeException("transaction timed out")),
        new QueryTimeoutException("query timed out"),
        new TransactionTimedOutException("transaction timed out"),
        new DataAccessResourceFailureException("db unreachable")
    };

    for (Exception ex : exceptions) {
      var response = handler.handleDatabaseUnavailable(ex);
      assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode(), ex.getClass().getSimpleName());
      assertEquals("2", response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER), ex.getClass().getSimpleName());
      assertNotNull(response.getBody());
    }
  }

  @Test
  void handleRuntimeExceptionStillReturns500() {
    var response = handler.handleRuntimeException(new RuntimeException("unexpected"));
    assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    assertNotNull(response.getBody());
  }
}
