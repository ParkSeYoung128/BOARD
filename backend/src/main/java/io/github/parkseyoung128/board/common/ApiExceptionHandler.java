package io.github.parkseyoung128.board.common;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApi(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(new ApiError(e.getCode(), e.getMessage()));
    }

    /** 본문이 JSON 이 아니거나 비어 있는 경우. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException e) {
        return validation("요청 본문을 읽을 수 없습니다.");
    }

    /** limit=abc 처럼 타입이 맞지 않는 파라미터. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return validation("'" + e.getName() + "' 값이 올바르지 않습니다.");
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParam(MissingServletRequestParameterException e) {
        return validation("'" + e.getParameterName() + "' 값이 필요합니다.");
    }

    private static ResponseEntity<ApiError> validation(String message) {
        ApiException e = ApiException.validation(message);
        return ResponseEntity.status(e.getStatus()).body(new ApiError(e.getCode(), e.getMessage()));
    }
}
