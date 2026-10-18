-- The notification contains only the guild scope, never payer/user data.
-- A NOTIFY is delivered only on transaction commit.
CREATE OR REPLACE FUNCTION vb_nobre_yue_entitlement_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE guild text;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF OLD."status" IS NOT DISTINCT FROM NEW."status" AND
      OLD."expiresAt" IS NOT DISTINCT FROM NEW."expiresAt" AND
      OLD."revokedAt" IS NOT DISTINCT FROM NEW."revokedAt" AND
      OLD."roleId" IS NOT DISTINCT FROM NEW."roleId" THEN
     RETURN NULL;
   END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN
  guild := OLD."guildId";
 ELSE
  guild := NEW."guildId";
 END IF;
 PERFORM pg_notify('vb_nobre_yue_changed', guild);
 RETURN NULL;
END;
$$;
CREATE TRIGGER vb_nobre_yue_entitlement_notify
 AFTER INSERT OR UPDATE OR DELETE ON "support_entitlements"
 FOR EACH ROW EXECUTE FUNCTION vb_nobre_yue_entitlement_changed();

CREATE OR REPLACE FUNCTION vb_nobre_yue_payment_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."status" IS DISTINCT FROM NEW."status" THEN
  PERFORM pg_notify('vb_nobre_yue_changed', NEW."guildId");
 END IF;
 RETURN NULL;
END;
$$;
CREATE TRIGGER vb_nobre_yue_payment_notify
 AFTER UPDATE OF "status" ON "support_payments"
 FOR EACH ROW EXECUTE FUNCTION vb_nobre_yue_payment_changed();
