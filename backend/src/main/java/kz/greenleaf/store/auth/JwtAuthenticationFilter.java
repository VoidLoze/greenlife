package kz.greenleaf.store.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import kz.greenleaf.store.common.GlobalExceptionHandler;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String INVALID_TOKEN_ATTRIBUTE = "gl.auth.invalidToken";
    private static final String BEARER = "Bearer ";

    private final JwtService jwtService;
    private final TokenRevocationService revocation;
    private final JsonMapper jsonMapper;

    public JwtAuthenticationFilter(JwtService jwtService, TokenRevocationService revocation, JsonMapper jsonMapper) {
        this.jwtService = jwtService;
        this.revocation = revocation;
        this.jsonMapper = jsonMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER)) {
            Optional<JwtService.ParsedToken> parsed = jwtService.parse(header.substring(BEARER.length()).trim());
            if (parsed.isPresent() && !revocation.isRevoked(parsed.get())) {
                AuthPrincipal principal = parsed.get().principal();
                var authentication = new UsernamePasswordAuthenticationToken(principal, null,
                        List.of(new SimpleGrantedAuthority(principal.role().authority())));
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else if (!request.getRequestURI().startsWith("/api/auth/")) {
                // An expired token must not silently downgrade a signed-in shopper to a guest on open endpoints
                // (a partner would see and pay retail prices): answer 401 so the client refreshes and retries.
                rejectInvalidToken(response);
                return;
            } else {
                request.setAttribute(INVALID_TOKEN_ATTRIBUTE, Boolean.TRUE);
            }
        }
        chain.doFilter(request, response);
    }

    private void rejectInvalidToken(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        jsonMapper.writeValue(response.getOutputStream(), GlobalExceptionHandler.problem(HttpStatus.UNAUTHORIZED,
                "token_invalid", "Токен недействителен или истёк"));
    }

    public Optional<JwtService.ParsedToken> parseFromRequest(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER)) {
            return Optional.empty();
        }
        return jwtService.parse(header.substring(BEARER.length()).trim());
    }
}
