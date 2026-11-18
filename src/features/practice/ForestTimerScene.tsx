import { useEffect, useMemo, useRef, useState } from 'react';
import stand from '../../assets/stand.png';
import fly1 from '../../assets/fly1.png';
import fly2 from '../../assets/fly2.png';
import trunk from '../../assets/tronco.png';
import { createForestTimeline, getForestTimelineFrame } from './forestTimeline';
import styles from './practice.module.css';

const supports = [
  { x: 282, y: 276, width: 82 },
  { x: 708, y: 288, width: 104 },
  { x: 226, y: 337, width: 158 },
  { x: 704, y: 386, width: 192 },
  { x: 238, y: 482, width: 294 },
] as const;

// Adjust these two values to reposition only the painted path in the scene viewBox.
const PATH_OFFSET_X = -118;
const PATH_OFFSET_Y = 28;

type Point = { x: number; y: number };

function birdPosition(elapsedMs: number, durationMinutes: number) {
  const timeline = createForestTimeline(durationMinutes);
  const frame = getForestTimelineFrame(timeline, elapsedMs);
  if (frame.phase === 'complete') {
    return { ...supports[4], phase: frame.phase, from: 4, to: 4, progress: 1, facingRight: true };
  }
  if (frame.phase === 'waiting') {
    return {
      ...supports[frame.supportIndex],
      phase: frame.phase,
      from: frame.supportIndex,
      to: frame.supportIndex,
      progress: 0,
      facingRight: frame.supportIndex % 2 === 0,
    };
  }

  const from = supports[frame.fromSupportIndex];
  const to = supports[frame.toSupportIndex];
  const control: Point = {
    x: (from.x + to.x) / 2,
    y: Math.min(from.y, to.y) - (62 + frame.toSupportIndex * 9),
  };
  const inverse = 1 - frame.progress;
  const x = inverse * inverse * from.x + 2 * inverse * frame.progress * control.x + frame.progress * frame.progress * to.x;
  const y = inverse * inverse * from.y + 2 * inverse * frame.progress * control.y + frame.progress * frame.progress * to.y;
  const width = from.width + (to.width - from.width) * frame.progress;
  return {
    x,
    y,
    width,
    phase: frame.phase,
    from: frame.fromSupportIndex,
    to: frame.toSupportIndex,
    progress: frame.progress,
    facingRight: to.x > from.x,
  };
}

export function ForestTimerScene({
  elapsedMs,
  durationMinutes,
  reducedMotion,
  paused = false,
  completed = false,
  singing = false,
  running = false,
  label,
}: {
  elapsedMs: number;
  durationMinutes: number;
  reducedMotion: boolean;
  paused?: boolean;
  completed?: boolean;
  singing?: boolean;
  running?: boolean;
  label: string;
}) {
  const [frameElapsedMs, setFrameElapsedMs] = useState(elapsedMs);
  const elapsedRef = useRef(elapsedMs);
  useEffect(() => {
    elapsedRef.current = elapsedMs;
  }, [elapsedMs]);

  useEffect(() => {
    if (!running || reducedMotion || paused || completed || typeof window.requestAnimationFrame !== 'function') {
      return undefined;
    }

    let frameId = 0;
    let previousFrameMs: number | null = null;
    const renderFrame = (frameMs: number) => {
      if (previousFrameMs !== null) {
        elapsedRef.current = Math.min(
          durationMinutes * 60_000,
          elapsedRef.current + Math.max(0, frameMs - previousFrameMs),
        );
        setFrameElapsedMs(elapsedRef.current);
      }
      previousFrameMs = frameMs;
      frameId = window.requestAnimationFrame(renderFrame);
    };

    frameId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [completed, durationMinutes, paused, reducedMotion, running]);

  const sceneElapsedMs = running && !paused && !reducedMotion
    ? Math.max(elapsedMs, frameElapsedMs)
    : elapsedMs;
  const position = useMemo(
    () => reducedMotion
      ? { ...supports[4], phase: 'waiting' as const, from: 4, to: 4, progress: 0, facingRight: true }
      : birdPosition(sceneElapsedMs, durationMinutes),
    [durationMinutes, reducedMotion, sceneElapsedMs],
  );
  const flying = !reducedMotion && !paused && position.phase === 'flying';
  const bird = flying && Math.floor(sceneElapsedMs / 100) % 2 === 0 ? fly1 : flying ? fly2 : stand;
  const birdWidth = position.width * 0.72;
  const birdHeight = birdWidth * 0.78;
  const shadowWidth = position.width * 0.56;
  const shadowY = position.y + 105;

  return (
    <div
      aria-label={label}
      className={styles.sceneFrame}
      data-reduced-motion={String(reducedMotion)}
      data-support-index={String(position.to)}
      data-flying={String(flying)}
      data-position-x={String(Math.round(position.x))}
      data-facing={position.facingRight ? 'right' : 'left'}
      data-scene-elapsed={String(Math.round(sceneElapsedMs))}
      data-singing={String(singing)}
      data-testid="forest-scene"
      role="img"
    >
      <svg aria-hidden="true" className={styles.scene} preserveAspectRatio="xMidYMid meet" viewBox="0 0 1000 540">
        <defs>
          <linearGradient id="forest-sky" x2="0" y2="1">
            <stop stopColor="#9bdcf4" />
            <stop offset="1" stopColor="#d6f1ed" />
          </linearGradient>
          <linearGradient id="forest-path" x2="0" y2="1">
            <stop stopColor="#e7bd7b" />
            <stop offset="1" stopColor="#f3d39b" />
          </linearGradient>
        </defs>
        <rect width="1000" height="540" fill="url(#forest-sky)" />
        <path d="M0 230 Q110 180 224 229 T450 218 T700 222 T1000 192 V355 H0Z" fill="#c6d79b" />
        <g fill="#b7ce8c" opacity=".9">
          <circle cx="86" cy="220" r="57" /><circle cx="178" cy="211" r="74" />
          <circle cx="376" cy="216" r="62" /><circle cx="553" cy="204" r="72" />
          <circle cx="817" cy="206" r="76" /><circle cx="930" cy="221" r="58" />
        </g>
        <path d="M0 282 Q170 251 335 291 Q500 330 1000 262 V540 H0Z" fill="#b3cd72" />
        <path
          d="M434 270 C560 296 553 339 472 369 C392 399 444 442 570 540 H804 C682 451 673 407 751 365 C841 317 752 282 624 260Z"
          fill="url(#forest-path)"
          transform={`translate(${PATH_OFFSET_X} ${PATH_OFFSET_Y})`}
        />
        <path d="M0 0 H120 L91 78 149 104 101 180 142 236 89 260 0 286Z" fill="#775239" />
        <path d="M31 0 H54 L66 113 121 164 101 178 53 137Z" fill="#966a45" />
        <path d="M845 0 H1000 V280 L935 250 889 194 923 135 879 90Z" fill="#70503b" />
        <g fill="#74944a">
          <ellipse cx="66" cy="-12" rx="176" ry="104" fill="#82a64f" />
          <ellipse cx="185" cy="9" rx="145" ry="77" fill="#a6bd5d" />
          <ellipse cx="936" cy="-9" rx="163" ry="108" fill="#789847" />
          <ellipse cx="824" cy="14" rx="146" ry="77" fill="#9fb957" />
          <ellipse cx="60" cy="250" rx="110" ry="40" /><ellipse cx="953" cy="269" rx="105" ry="51" />
          <ellipse cx="87" cy="286" rx="94" ry="33" /><ellipse cx="923" cy="307" rx="99" ry="39" />
        </g>
        <g fill="#8fad54">
          <path d="M0 472q70-91 147 0-73-29-147 0M845 473q77-96 155 0-79-31-155 0" />
          <path d="M35 500q26-87 55 0-29-26-55 0M928 500q22-89 50 0-25-27-50 0" />
        </g>
        {flying && (
          <ellipse
            cx={position.x}
            cy={shadowY}
            rx={shadowWidth / 2}
            ry={Math.max(5, shadowWidth * 0.055)}
            fill="#62472b"
            opacity=".2"
            data-testid="forest-shadow"
          />
        )}
        {supports.map((support, index) => (
          <image
            key={index}
            href={trunk}
            x={support.x - support.width / 2}
            y={support.y - support.width * 0.24}
            width={support.width}
            height={support.width * 0.56}
            preserveAspectRatio="xMidYMid meet"
          />
        ))}
        <g transform={`translate(${position.x} 0) scale(${position.facingRight ? 1 : -1} 1) translate(${-position.x} 0)`}>
          <image
            href={bird}
            x={position.x - birdWidth / 2}
            y={position.y - birdHeight}
            width={birdWidth}
            height={birdHeight}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
        {singing && completed && (
          <g fill="none" stroke="#5c2d00" strokeLinecap="round" strokeWidth="5">
            <path d="M371 401q21-19 0-38" /><path d="M389 407q32-31 0-62" /><path d="M409 411q42-42 0-84" />
          </g>
        )}
        <g fill="#e2c984" opacity=".8">
          <ellipse cx="510" cy="462" rx="22" ry="9" /><ellipse cx="586" cy="498" rx="28" ry="10" /><ellipse cx="462" cy="517" rx="15" ry="7" />
        </g>
      </svg>
    </div>
  );
}
