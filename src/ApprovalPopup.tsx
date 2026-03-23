import './ApprovalPopup.css';

type ToolArgs = Record<string, string | number | boolean | null | undefined>;

interface ApprovalPopupProps {
  tool: string;
  args: ToolArgs;
  onApprove: () => void;
  onDeny: () => void;
  queueCount?: number;
}

// Format tool args into a clean property list
function formatArgs(args: ToolArgs): { label: string; value: string }[] {
  if (!args || typeof args !== 'object') return [];

  const properties: { label: string; value: string }[] = [];

  for (const [key, val] of Object.entries(args)) {
    if (val === undefined || val === null) continue;
    
    // Format the label (e.g., "app_name" -> "App Name")
    const label = key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Format the value
    let value: string;
    if (typeof val === 'string') {
      value = val;
    } else if (typeof val === 'number') {
      value = val.toString();
    } else if (typeof val === 'boolean') {
      value = val ? 'Yes' : 'No';
    } else {
      value = JSON.stringify(val);
    }
    
    properties.push({ label, value });
  }
  
  return properties;
}

// Get a human-readable description of the action
function getActionDescription(tool: string, args: ToolArgs): string {
  if (tool === 'system_settings' && args?.setting === 'volume') {
    const action = args?.action;
    const level = args?.level;
    const amount = args?.amount;

    switch (action) {
      case 'set':
        return level !== undefined ? `Set volume to ${level}%` : 'Set volume';
      case 'increase':
        return amount !== undefined
          ? `Increase volume by ${amount}%`
          : 'Increase volume';
      case 'decrease':
        return amount !== undefined
          ? `Decrease volume by ${amount}%`
          : 'Decrease volume';
      case 'mute':
      case 'unmute':
      case 'toggle':
        return 'Toggle mute';
      default:
        return 'Adjust volume';
    }
  }

  if (tool === 'open_application') {
    const appName = args?.app_name;
    return appName ? `Open ${appName}` : 'Open application';
  }

  if (tool === 'take_screenshot') {
    return 'Take screenshot';
  }

  return tool.replace(/_/g, ' ');
}

export function ApprovalPopup({ tool, args, onApprove, onDeny, queueCount = 1 }: ApprovalPopupProps) {
  const properties = formatArgs(args);
  const actionDescription = getActionDescription(tool, args);
  const hasMoreRequests = queueCount > 1;
  
  return (
    <div className="approval-overlay">
      <div className="approval-container">
        <div className="approval-header">
          <div className="approval-title">
            <div className="approval-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v4"/>
                <circle cx="12" cy="16" r="1"/>
              </svg>
            </div>
            <div className="title-group">
              <h2>Jarvis Action Request</h2>
              {hasMoreRequests && (
                <span className="queue-badge">{queueCount} pending</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="approval-content">
          <div className="approval-action">
            <span className="label">Action</span>
            <div className="action-row">
              <span className="tool-name">{tool}</span>
              <span className="action-description">{actionDescription}</span>
            </div>
          </div>
          
          {properties.length > 0 && (
            <div className="approval-args">
              <span className="label">Details</span>
              <div className="args-list">
                {properties.map((prop, index) => (
                  <div key={index} className="arg-item">
                    <span className="arg-key">{prop.label}</span>
                    <span className="arg-value">{prop.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="approval-actions">
          <button className="btn-deny" onClick={onDeny}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Deny
          </button>
          <button className="btn-approve" onClick={onApprove}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
