import { useMemo } from "react";
import { sendPluginEvent } from "../../ipc/plugins";
import { parseActivity, parseNode, parsePeek, type Color, type Node } from "./tree";
import { usePluginPeek, usePluginViews } from "./store";
import "./plugins.css";

const ignore = () => {};

function act(id: string, action: string, value?: unknown) {
  sendPluginEvent(id, "action", action, value).catch(ignore);
}

const color = (c: Color) => `var(--pc-${c})`;

/** The ring of a progress, as on the timer. */
function Ring({ value, size, tint }: { value: number; size: number; tint: Color }) {
  const r = size / 2 - 2;
  const length = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ color: color(tint) }} aria-hidden="true">
      <circle className="pv-ring-track" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="pv-ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - value)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function View({ node, id }: { node: Node; id: string }) {
  switch (node.type) {
    case "stack":
      return (
        <div
          className={`pv-stack pv-stack--${node.direction} pv-align--${node.align} pv-justify--${node.justify}`}
          style={{ gap: node.gap, flex: node.grow ? 1 : undefined }}
        >
          {node.children.map((child, i) => (
            <View key={i} node={child} id={id} />
          ))}
        </div>
      );
    case "text":
      return (
        <span className={`pv-text pv-text--${node.style}`} style={{ color: color(node.color), WebkitLineClamp: node.lines }}>
          {node.text}
        </span>
      );
    case "icon":
      return (
        <span className="pv-icon" style={{ fontSize: node.size }}>
          {node.icon}
        </span>
      );
    case "button":
      return (
        <button
          className={`pv-button pv-button--${node.style}`}
          style={{ "--tint": color(node.color) } as React.CSSProperties}
          aria-label={node.label || node.icon}
          title={node.style === "round" ? node.label : undefined}
          onClick={(e) => {
            e.stopPropagation();
            act(id, node.action);
          }}
        >
          {node.icon && <span className="pv-button-icon">{node.icon}</span>}
          {node.label && node.style !== "round" && <span>{node.label}</span>}
        </button>
      );
    case "toggle":
      return (
        <label className="pv-toggle-row" onClick={(e) => e.stopPropagation()}>
          {node.label && <span className="pv-text pv-text--body">{node.label}</span>}
          <button
            className={`pv-toggle ${node.value ? "pv-toggle--on" : ""}`}
            role="switch"
            aria-checked={node.value}
            aria-label={node.label}
            onClick={() => act(id, node.action, !node.value)}
          >
            <span className="pv-toggle-knob" />
          </button>
        </label>
      );
    case "progress":
      return node.ring ? (
        <Ring value={node.value} size={node.size} tint={node.color} />
      ) : (
        <div className="pv-bar">
          <div className="pv-bar-fill" style={{ transform: `scaleX(${node.value})`, background: color(node.color) }} />
        </div>
      );
    case "list":
      return (
        <div className="pv-list">
          {node.items.map((item, i) => (
            <div
              key={i}
              className={`pv-item ${item.action ? "pv-item--action" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (item.action) act(id, item.action);
              }}
            >
              {item.icon && <span className="pv-item-icon">{item.icon}</span>}
              <span className="pv-item-text">
                <span className="pv-item-title">{item.title}</span>
                {item.subtitle && <span className="pv-item-sub">{item.subtitle}</span>}
              </span>
              {item.trailing && <span className="pv-item-trailing">{item.trailing}</span>}
            </div>
          ))}
        </div>
      );
    case "spacer":
      return <span className="pv-spacer" />;
  }
}

/** A plugin's tab: the tree it rendered last. */
export function PluginTab({ id }: { id: string }) {
  const views = usePluginViews();
  const raw = views.find((v) => v.id === id)?.tab;
  const node = useMemo(() => parseNode(raw), [raw]);
  return <div className="pv-tab">{node && <View node={node} id={id} />}</div>;
}

/** The closed island while a plugin has something live. */
export function PluginActivity({ id }: { id: string }) {
  const views = usePluginViews();
  const raw = views.find((v) => v.id === id)?.activity;
  const activity = useMemo(() => parseActivity(raw), [raw]);
  if (!activity) return null;
  return (
    <div className="pv-activity" style={{ color: color(activity.color) }}>
      {activity.progress !== null ? <Ring value={activity.progress} size={18} tint={activity.color} /> : <span className="pv-activity-icon">{activity.icon}</span>}
      <span className="pv-activity-text">{activity.text}</span>
    </div>
  );
}

/** A plugin's moment on the island. */
export function PluginPeek() {
  const event = usePluginPeek();
  const peek = useMemo(() => parsePeek(event?.peek), [event]);
  if (!peek) return null;
  return (
    <div className="pv-peek">
      {peek.icon && <span className="pv-peek-icon">{peek.icon}</span>}
      <span className="pv-peek-text">
        <span className="pv-peek-title">{peek.title}</span>
        {peek.text && <span className="pv-peek-sub">{peek.text}</span>}
      </span>
    </div>
  );
}
