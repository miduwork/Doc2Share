-- Seed categories: grades 1-12, subjects, exams
INSERT INTO categories (name, type) VALUES
  ('Lớp 1', 'grade'),
  ('Lớp 2', 'grade'),
  ('Lớp 3', 'grade'),
  ('Lớp 4', 'grade'),
  ('Lớp 5', 'grade'),
  ('Lớp 6', 'grade'),
  ('Lớp 7', 'grade'),
  ('Lớp 8', 'grade'),
  ('Lớp 9', 'grade'),
  ('Lớp 10', 'grade'),
  ('Lớp 11', 'grade'),
  ('Lớp 12', 'grade');

INSERT INTO categories (name, type) VALUES
  ('Toán học', 'subject'),
  ('Ngữ văn', 'subject'),
  ('Tiếng Anh', 'subject'),
  ('Vật lý', 'subject'),
  ('Hóa học', 'subject'),
  ('Sinh học', 'subject'),
  ('Lịch sử', 'subject'),
  ('Địa lý', 'subject'),
  ('GDCD', 'subject'),
  ('Tin học', 'subject');

INSERT INTO categories (name, type) VALUES
  ('Đề thi THPT Quốc gia', 'exam'),
  ('Đánh giá năng lực', 'exam'),
  ('Học kỳ I', 'exam'),
  ('Học kỳ II', 'exam'),
  ('Giữa kỳ', 'exam');
