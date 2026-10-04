-- Baho: 0.5 qadam bilan 0.5 … 5 (yarim yulduz). Eski cheklov faqat 1..5 oralig‘ini (butun sonlar) kutardi.
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_rating_range";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" >= 0.5 AND "rating" <= 5 AND ("rating" * 2) = floor("rating" * 2));
