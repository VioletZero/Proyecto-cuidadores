import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { theme } from '../styles/theme';

export interface LineChartDataPoint {
  label: string; // Fecha o texto corto
  value: number; // 1 (Bajo), 2 (Moderado), 3 (Alto)
  color: string;
}

interface LineChartProps {
  data: LineChartDataPoint[];
  width?: number;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = 300,
  height = 200,
}) => {
  if (!data || data.length === 0) return null;

  const padding = 30;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Los valores posibles son 1, 2, 3
  const maxValue = 3;
  const minValue = 1;

  // Función para escalar X
  const getX = (index: number) => {
    if (data.length === 1) return padding + chartWidth / 2;
    return padding + (index / (data.length - 1)) * chartWidth;
  };

  // Función para escalar Y
  const getY = (value: number) => {
    // value = 3 -> maxY (padding), value = 1 -> minY (padding + chartHeight)
    const range = maxValue - minValue;
    const normalized = (value - minValue) / (range || 1);
    return padding + chartHeight - normalized * chartHeight;
  };

  // Generar path de la línea
  let pathD = '';
  data.forEach((point, index) => {
    const x = getX(index);
    const y = getY(point.value);
    if (index === 0) {
      pathD += `M ${x} ${y} `;
    } else {
      pathD += `L ${x} ${y} `;
    }
  });

  return (
    <View style={{ width, height, alignItems: 'center' }}>
      <Svg width={width} height={height}>
        {/* Ejes (Opcional, podemos dibujar líneas sutiles horizontales) */}
        {[1, 2, 3].map((val) => (
          <Line
            key={`grid-${val}`}
            x1={padding}
            y1={getY(val)}
            x2={width - padding}
            y2={getY(val)}
            stroke="#E9ECEF"
            strokeWidth="1"
            strokeDasharray="4, 4"
          />
        ))}

        {/* Textos del Eje Y */}
        <SvgText x={padding - 5} y={getY(3) + 4} fontSize="10" fill="#A4B0BE" textAnchor="end">Alto</SvgText>
        <SvgText x={padding - 5} y={getY(2) + 4} fontSize="10" fill="#A4B0BE" textAnchor="end">Med</SvgText>
        <SvgText x={padding - 5} y={getY(1) + 4} fontSize="10" fill="#A4B0BE" textAnchor="end">Bajo</SvgText>

        {/* Línea principal */}
        <Path d={pathD} fill="none" stroke={theme.colors.primaryDark} strokeWidth={3} />

        {/* Puntos y etiquetas X */}
        {data.map((point, index) => {
          const x = getX(index);
          const y = getY(point.value);
          return (
            <React.Fragment key={`point-${index}`}>
              <Circle
                cx={x}
                cy={y}
                r={5}
                fill={point.color}
                stroke="#FFF"
                strokeWidth={2}
              />
              <SvgText
                x={x}
                y={height - 10}
                fontSize="10"
                fill="#57606F"
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};
