import './ApprovalPopup.css';
import { useState } from 'react';

type ToolArgs = Record<string, string | number | boolean | null | undefined>;

interface ApprovalPopupProps {
  tool: string;
  args: ToolArgs;
  onApprove: () => void;
  onDeny: () => void;
  queueCount?: number;
}

interface FormattedArg {
  label: string;
  value: string;
  important: boolean;
}

const IMPORTANT_ARG_KEYS = new Set(['app_name', 'setting', 'action', 'level', 'amount']);

// Format tool args into a clean property list
function formatArgs(args: ToolArgs): FormattedArg[] {
  if (!args || typeof args !== 'object') return [];

  const properties: FormattedArg[] = [];

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
    
    properties.push({ label, value, important: IMPORTANT_ARG_KEYS.has(key) });
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
  const [isReviewingDetails, setIsReviewingDetails] = useState(false);
  const properties = formatArgs(args);
  const actionDescription = getActionDescription(tool, args);
  const hasMoreRequests = queueCount > 1;
  const primaryProperties = properties.filter(prop => prop.important).slice(0, 3);
  const visibleProperties = primaryProperties.length > 0
    ? primaryProperties
    : properties.slice(0, 3);
  const hiddenDetailCount = Math.max(properties.length - visibleProperties.length, 0);
  
  return (
    <div className="approval-overlay">
      <div className={`approval-container ${isReviewingDetails ? 'is-reviewing' : ''}`}>
        <div className="approval-header">
          <div className="approval-title">
            <div className="approval-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h7"/>
                <path d="M13 5l6 7-6 7"/>
                <path d="M4 6h4"/>
                <path d="M4 18h4"/>
                <circle cx="11" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <div className="title-group">
              <h2>{isReviewingDetails ? 'Review action details' : 'Jarvis Action Request'}</h2>
              {hasMoreRequests && (
                <span className="queue-badge">{queueCount} pending</span>
              )}
            </div>
          </div>
        </div>
        
        {!isReviewingDetails ? (
          <div className="approval-content">
            <div className="approval-action">
              <span className="label">Action</span>
              <div className="action-row">
                <span className="tool-name">{tool}</span>
                <span className="action-description">{actionDescription}</span>
              </div>
            </div>
            
            {visibleProperties.length > 0 && (
              <div className="approval-args">
                <span className="label">Key details</span>
                <div className="args-list compact">
                  {visibleProperties.map((prop) => (
                    <div key={prop.label} className="arg-item">
                      <span className="arg-key">{prop.label}</span>
                      <span className="arg-value">{prop.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="approval-review-strip">
              <div>
                <span className="review-kicker">Preflight</span>
                <span className="review-copy">
                  {properties.length === 0
                    ? 'No extra parameters were supplied.'
                    : `${properties.length} parameter${properties.length === 1 ? '' : 's'} available for review.`}
                </span>
              </div>
              {properties.length > 0 && (
                <button className="btn-review" onClick={() => setIsReviewingDetails(true)}>
                  {hiddenDetailCount > 0 ? `Review all (${properties.length})` : 'Review details'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="approval-content details-mode">
            <div className="details-banner">
              <span className="label">Tool</span>
              <div className="details-tool-row">
                <span className="tool-name">{tool}</span>
                <span className="action-description">{actionDescription}</span>
              </div>
            </div>

            <div className="details-grid">
              {properties.map((prop) => (
                <div key={prop.label} className="detail-tile">
                  <span className="arg-key">{prop.label}</span>
                  <span className="detail-value">{prop.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="approval-actions">
          <button className="btn-deny" onClick={isReviewingDetails ? () => setIsReviewingDetails(false) : onDeny}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isReviewingDetails ? (
                <>
                  <polyline points="15 18 9 12 15 6"/>
                </>
              ) : (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </>
              )}
            </svg>
            {isReviewingDetails ? 'Back' : 'Deny'}
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
