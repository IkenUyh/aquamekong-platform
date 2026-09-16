ALTER TABLE water_metrics ADD COLUMN rainfall DOUBLE PRECISION;

COMMENT ON COLUMN water_metrics.rainfall IS 'Lượng mưa (mm)';
