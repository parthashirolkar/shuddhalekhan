export function RecordingPopup() {
  const bars = Array.from({ length: 12 });

  return (
    <div className="recording-root">
      <div className="recording-pill" role="status" aria-label="Recording in progress">
        <div className="bars">
          {bars.map((_, index) => (
            <span
              key={index}
              className="bar"
              style={{ animationDelay: `${index * 0.06}s` }}
            />
          ))}
        </div>
      </div>
      <style>{`
        html,
        body,
        #root {
          margin: 0;
          width: 100%;
          height: 100%;
          background: transparent !important;
          overflow: hidden;
        }

        .recording-root {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          overflow: hidden;
        }

        .recording-pill {
          width: 102px;
          height: 46px;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.22);
          background: #141417;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bars {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 20px;
        }

        .bar {
          width: 2px;
          height: 8px;
          border-radius: 999px;
          background: #f5f5f5;
          animation: pulse 0.9s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scaleY(0.7);
            opacity: 0.7;
          }
          50% {
            transform: scaleY(1.8);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
