-- Add minXP, minLevel, minLuazinhas fields to Giveaway model
ALTER TABLE "giveaways" ADD COLUMN "minXP" INTEGER;
ALTER TABLE "giveaways" ADD COLUMN "minLevel" INTEGER;
ALTER TABLE "giveaways" ADD COLUMN "minLuazinhas" INTEGER;
