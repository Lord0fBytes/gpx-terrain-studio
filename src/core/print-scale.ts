export interface PrintScaleInput {
  readonly selectionWidthM: number;
  readonly selectionDepthM: number;
  readonly printedWidthMm: number;
}

export interface PrintScale {
  readonly horizontalModelScaleMmPerM: number;
  readonly printedWidthMm: number;
  readonly printedDepthMm: number;
}

function positiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a finite positive number.`);
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

/** Derives fixed-aspect print dimensions without modifying the geographic selection. */
export function derivePrintScale(input: PrintScaleInput): PrintScale {
  positiveFinite(input.selectionWidthM, 'selectionWidthM');
  positiveFinite(input.selectionDepthM, 'selectionDepthM');
  positiveFinite(input.printedWidthMm, 'printedWidthMm');
  const horizontalModelScaleMmPerM = input.printedWidthMm / input.selectionWidthM;
  return {
    horizontalModelScaleMmPerM,
    printedWidthMm: input.printedWidthMm,
    printedDepthMm: input.selectionDepthM * horizontalModelScaleMmPerM
  };
}

/** Converts a finite DEM sample to terrain relief in millimeters above its documented datum. */
export function elevationToModelMm(
  elevationM: number,
  datumM: number,
  horizontalModelScaleMmPerM: number,
  verticalExaggeration: number
): number {
  finite(elevationM, 'elevationM');
  finite(datumM, 'datumM');
  positiveFinite(horizontalModelScaleMmPerM, 'horizontalModelScaleMmPerM');
  positiveFinite(verticalExaggeration, 'verticalExaggeration');
  return (elevationM - datumM) * horizontalModelScaleMmPerM * verticalExaggeration;
}
