package kz.greenleaf.store.media;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Keeps the blob store consistent with the database: files written inside a transaction are removed if it rolls
 * back, and files scheduled for deletion are only removed once the transaction has committed.
 */
@Component
public class StorageTransactions {

    private static final Logger log = LoggerFactory.getLogger(StorageTransactions.class);

    private final FileStorage storage;

    public StorageTransactions(FileStorage storage) {
        this.storage = storage;
    }

    public void deleteOnRollback(String... keys) {
        List<String> targets = clean(Arrays.asList(keys));
        if (targets.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deleteQuietly(targets);
                }
            }
        });
    }

    public void deleteAfterCommit(Collection<String> keys) {
        List<String> targets = clean(keys);
        if (targets.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(targets);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(targets);
            }
        });
    }

    private void deleteQuietly(List<String> keys) {
        for (String key : keys) {
            try {
                storage.delete(key);
            } catch (RuntimeException ex) {
                log.warn("Failed to delete stored file {}: {}", key, ex.getMessage());
            }
        }
    }

    private static List<String> clean(Collection<String> keys) {
        return keys.stream().filter(Objects::nonNull).distinct().toList();
    }
}
