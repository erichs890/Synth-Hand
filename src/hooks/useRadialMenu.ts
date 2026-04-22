export interface Point {
  x: number;
  y: number;
}

export interface UseRadialMenuOptions {
  /** Posição do dedo em pixels. `null` quando a mão não está detectada. */
  point: Point | null;
  /** Centro fixo da roleta em pixels. */
  center: Point;
  /** Quantas fatias a roleta tem (ex: 8). */
  slices: number;
  /** Distância mínima (px) para registrar uma seleção. */
  deadzone: number;
  /**
   * Offset angular em radianos. Por padrão 0 → fatia 0 centrada ao norte,
   * fatias crescendo no sentido horário.
   */
  startAngle?: number;
}

export interface UseRadialMenuResult {
  /** Índice da fatia selecionada, ou `null` dentro da deadzone / sem ponto. */
  selectedIndex: number | null;
  /** Ângulo bruto (radianos) do ponto em relação ao centro, p/ visualização. */
  angle: number | null;
  /** Distância (px) do ponto ao centro, p/ visualização. */
  distance: number | null;
}

const TAU = Math.PI * 2;

export function useRadialMenu({
  point,
  center,
  slices,
  deadzone,
  startAngle = 0,
}: UseRadialMenuOptions): UseRadialMenuResult {
  if (!point) {
    return { selectedIndex: null, angle: null, distance: null };
  }

  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);

  if (distance < deadzone) {
    return { selectedIndex: null, angle: Math.atan2(dy, dx), distance };
  }

  // atan2: 0 = leste, π/2 = sul (y cresce p/ baixo no DOM), -π/2 = norte.
  // Queremos: fatia 0 centrada ao norte, crescendo no sentido horário.
  // Deslocamento:
  //   +π/2      → move o zero pra cima (norte)
  //   +sliceSize/2 → centraliza a fatia 0 no norte (em vez de começar nela)
  //   -startAngle  → rotação custom do consumer
  const sliceSize = TAU / slices;
  let shifted = Math.atan2(dy, dx) + Math.PI / 2 + sliceSize / 2 - startAngle;
  // Normaliza em [0, 2π)
  shifted = ((shifted % TAU) + TAU) % TAU;

  const selectedIndex = Math.floor(shifted / sliceSize) % slices;

  return {
    selectedIndex,
    angle: Math.atan2(dy, dx),
    distance,
  };
}
