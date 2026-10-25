package kz.greenleaf.store.notify;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.order.OrderPlacedEvent;
import kz.greenleaf.store.site.StoreSettingsService;
import kz.greenleaf.store.site.StoreSettingsService.StoreSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.json.JsonMapper;

/** Sends every new order to the owner's Telegram chat right after it is saved; a Telegram outage never fails checkout. */
@Component
public class TelegramNotifier {

    private static final Logger log = LoggerFactory.getLogger(TelegramNotifier.class);
    private static final int MAX_TEXT = 3900;

    private final StoreSettingsService settings;
    private final JsonMapper json;
    private final String publicUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public TelegramNotifier(StoreSettingsService settings, JsonMapper json, AppProperties properties) {
        this.settings = settings;
        this.json = json;
        this.publicUrl = properties.publicUrl().replaceAll("/+$", "");
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderPlaced(OrderPlacedEvent event) {
        StoreSettings s = settings.current();
        if (!s.telegramEnabled()) {
            return;
        }
        String text = format(event);
        Thread.ofVirtual().name("telegram-order-" + event.number()).start(() -> {
            try {
                send(s.telegramBotToken(), s.telegramChatId(), text);
            } catch (Exception ex) {
                log.warn("Telegram alert for order {} failed: {}", event.number(), ex.getMessage());
            }
        });
    }

    /** Used by the "send a test message" button in the admin settings; the error text is shown to the admin. */
    public void sendTest(String token, String chatId) throws Exception {
        send(token, chatId, "✅ Greenleaf: уведомления о новых заказах подключены.\n" + publicUrl + "/admin/orders");
    }

    private void send(String token, String chatId, String text) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("chat_id", chatId.trim());
        body.put("text", text.length() > MAX_TEXT ? text.substring(0, MAX_TEXT) + "…" : text);
        body.put("disable_web_page_preview", true);
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot" + token.trim() + "/sendMessage"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            String description = response.body();
            try {
                Object parsed = json.readValue(response.body(), Map.class).get("description");
                if (parsed != null) {
                    description = parsed.toString();
                }
            } catch (RuntimeException ignored) {
                // Keep the raw body.
            }
            throw new IllegalStateException("Telegram ответил " + response.statusCode() + ": " + description);
        }
    }

    String format(OrderPlacedEvent e) {
        StringBuilder t = new StringBuilder();
        t.append("🛒 Новый заказ ").append(e.number()).append('\n');
        t.append(e.customerName()).append(", ").append(e.phone()).append('\n');
        t.append(e.delivery()).append('\n');
        t.append("Оплата: ").append(e.payment());
        if (e.partner()) {
            t.append(" · партнёрские цены");
        }
        t.append("\n\n");
        for (String line : e.lines()) {
            t.append("• ").append(line).append('\n');
        }
        t.append("\nИтого: ").append(e.total()).append(" ₸");
        if (e.comment() != null) {
            t.append("\nКомментарий: ").append(e.comment());
        }
        t.append("\n\n").append(publicUrl).append("/admin/orders/").append(e.orderId());
        return t.toString();
    }
}
