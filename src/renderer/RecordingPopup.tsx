import './RecordingPopup.css';

export function RecordingPopup() {
  const bars = Array.from({ length: 12 });

  return (
    <div className="recording-root">
      <div className="recording-pill transcription-mode" role="status" aria-label="Recording in progress">
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
    </div>
  );
}
