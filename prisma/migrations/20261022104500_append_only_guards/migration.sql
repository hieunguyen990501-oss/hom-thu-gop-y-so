-- Bảo vệ tính toàn vẹn của nhật ký kiểm toán và lịch sử xử lý:
-- không cho phép sửa (UPDATE) trong mọi trường hợp; chỉ cho phép xóa (DELETE)
-- khi thủ tục xóa theo chính sách lưu trữ đặt cờ phiên app.retention_purge = 'on'.

CREATE OR REPLACE FUNCTION htgy_block_history_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Bảng % chỉ cho phép ghi thêm; không được sửa hoặc xóa lịch sử (%).', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION htgy_block_history_mutation();

CREATE TRIGGER status_history_append_only
  BEFORE UPDATE OR DELETE ON "FeedbackStatusHistory"
  FOR EACH ROW EXECUTE FUNCTION htgy_block_history_mutation();

CREATE TRIGGER internal_note_append_only
  BEFORE UPDATE OR DELETE ON "InternalNote"
  FOR EACH ROW EXECUTE FUNCTION htgy_block_history_mutation();

CREATE TRIGGER feedback_message_append_only
  BEFORE UPDATE OR DELETE ON "FeedbackMessage"
  FOR EACH ROW EXECUTE FUNCTION htgy_block_history_mutation();

-- Chỉ mục tìm kiếm toàn văn đơn giản (không phân biệt hoa thường) cho tiêu đề và mã hồ sơ.
CREATE INDEX feedback_title_lower_idx ON "Feedback" (lower("title"));
