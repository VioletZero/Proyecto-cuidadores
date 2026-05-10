/**
 * PieChart.tsx
 * Componente de gráfico de torta (donut) usando react-native-svg puro.
 * No requiere gesture-handler ni reanimated.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface Slice {
  x: string;    // etiqueta (emoción)
  y: number;    // cantidad
  label: string; // porcentaje formateado
  color: string;
}

interface PieChartProps {
  data: Slice[];
  size?: number;
  innerRadiusFraction?: number; // 0.0 a <1.0 para donut
}

/**
 * Convierte un ángulo en grados a coordenadas [x, y] en el círculo.
 */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Genera el path SVG de un arco de sector circular.
 */
function slicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  // Aseguramos que si el ángulo es 360 (un solo dato) dibujemos casi-completo para evitar bug SVG
  const sweep = endAngle - startAngle;
  const safeSweep = sweep >= 360 ? 359.99 : sweep;
  const safeEnd = startAngle + safeSweep;

  const outer1 = polarToCartesian(cx, cy, outerR, startAngle);
  const outer2 = polarToCartesian(cx, cy, outerR, safeEnd);
  const inner1 = polarToCartesian(cx, cy, innerR, safeEnd);
  const inner2 = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = safeSweep > 180 ? 1 : 0;

  return [
    `M ${outer1.x} ${outer1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outer2.x} ${outer2.y}`,
    `L ${inner1.x} ${inner1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${inner2.x} ${inner2.y}`,
    'Z',
  ].join(' ');
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  size = 220,
  innerRadiusFraction = 0.45,
}) => {
  const total = data.reduce((s, d) => s + d.y, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * innerRadiusFraction;

  let currentAngle = 0;

  return (
    <View>
      <Svg width={size} height={size}>
        {data.map((slice, i) => {
          const sliceAngle = (slice.y / total) * 360;
          const path = slicePath(cx, cy, outerR, innerR, currentAngle, currentAngle + sliceAngle);
          currentAngle += sliceAngle;
          return (
            <Path
              key={i}
              d={path}
              fill={slice.color}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          );
        })}
        {/* Círculo interior opcional para efecto donut */}
      </Svg>
    </View>
  );
};
