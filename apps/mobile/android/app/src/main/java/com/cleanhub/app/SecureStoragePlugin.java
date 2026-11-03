package com.cleanhub.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** AES-GCM values in private preferences; the encryption key is non-exportable.
 * Backups and device transfer are disabled in this app's manifest/rules. */
@CapacitorPlugin(name = "SecureStorage")
public class SecureStoragePlugin extends Plugin {
    private static final String ALIAS = "cleanhub.mobile.credentials.v1";

    private SharedPreferences store() {
        return getContext().getSharedPreferences("cleanhub_secure_credentials", Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setKeySize(256).build());
        return generator.generateKey();
    }

    private String requireKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || !key.startsWith("cleanhub.mobile.")) throw new IllegalArgumentException("Invalid credential key");
        return key;
    }

    @PluginMethod
    public synchronized void get(PluginCall call) {
        try {
            String name = requireKey(call);
            String raw = store().getString(name, null);
            JSObject result = new JSObject();
            if (raw == null) {
                result.put("value", org.json.JSONObject.NULL);
            } else {
                String[] parts = raw.split(":", 2);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
                result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            }
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Secure credential read failed", "SECURE_STORAGE_READ", error);
        }
    }

    @PluginMethod
    public synchronized void set(PluginCall call) {
        try {
            String name = requireKey(call);
            String value = call.getString("value");
            if (value == null) throw new IllegalArgumentException("Missing credential value");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!store().edit().putString(name, encrypted).commit()) throw new IllegalStateException("Credential write failed");
            call.resolve();
        } catch (Exception error) {
            call.reject("Secure credential write failed", "SECURE_STORAGE_WRITE", error);
        }
    }

    @PluginMethod
    public synchronized void remove(PluginCall call) {
        try {
            if (!store().edit().remove(requireKey(call)).commit()) throw new IllegalStateException("Credential removal failed");
            call.resolve();
        } catch (Exception error) {
            call.reject("Secure credential removal failed", "SECURE_STORAGE_REMOVE", error);
        }
    }
}
