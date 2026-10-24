package kz.greenleaf.store.auth;

import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.GlobalExceptionHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthExceptionAdvice {

    private static final Logger log = LoggerFactory.getLogger(AuthExceptionAdvice.class);

    private final RefreshCookies cookies;

    public AuthExceptionAdvice(RefreshCookies cookies) {
        this.cookies = cookies;
    }

    @ExceptionHandler(AuthController.CookieClearingException.class)
    public ResponseEntity<ProblemDetail> handleRefreshFailure(AuthController.CookieClearingException ex) {
        if (ex.getCause() instanceof ApiException api) {
            ProblemDetail detail = GlobalExceptionHandler.problem(api.getStatus(), api.getCode(), api.getMessage());
            ResponseEntity.BodyBuilder builder = ResponseEntity.status(api.getStatus());
            if (api.getStatus() == HttpStatus.UNAUTHORIZED || api.getStatus() == HttpStatus.FORBIDDEN) {
                builder.header(HttpHeaders.SET_COOKIE, cookies.clear().toString());
            }
            return builder.body(detail);
        }
        log.error("Token refresh failed", ex.getCause());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(GlobalExceptionHandler.problem(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error",
                        "Внутренняя ошибка сервера"));
    }
}
