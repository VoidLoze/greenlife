package kz.greenleaf.store.media;

import java.io.IOException;
import java.io.InputStream;

/** Abstraction over the blob store so a local volume can later be swapped for S3/MinIO. */
public interface FileStorage {

    void write(String key, byte[] content) throws IOException;

    void copyFrom(String key, InputStream content) throws IOException;

    byte[] read(String key) throws IOException;

    void delete(String key);

    boolean exists(String key);
}
