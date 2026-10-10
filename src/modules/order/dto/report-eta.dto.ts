import { IsInt, Max, Min } from 'class-validator';

export class ReportEtaDto {
  /** Manzilgacha qolgan vaqt (soniya) — ustaning navigatori hisoblagan qiymat. */
  @IsInt()
  @Min(0)
  @Max(86_400)
  remainingS!: number;

  /** Manzilgacha qolgan masofa (metr). */
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  remainingM!: number;
}
