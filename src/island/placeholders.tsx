/**
 * Stand-in content for step 2, only there to judge the shell's motion.
 * Replaced by the media module (ported from Bloom) in step 4.
 */

function Bars() {
  return (
    <span className="ph-bars" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function ActivityPlaceholder() {
  return (
    <div className="ph-activity">
      <span className="ph-art ph-art--xs" />
      <Bars />
    </div>
  );
}

export function PeekPlaceholder() {
  return (
    <div className="ph-peek">
      <span className="ph-art ph-art--sm" />
      <span className="ph-text">
        <span className="ph-title">Titre de la piste</span>
        <span className="ph-sub">Artiste</span>
      </span>
      <Bars />
    </div>
  );
}

export function ExpandedPlaceholder() {
  return (
    <div className="ph-expanded">
      <div className="ph-tabs">
        <span className="ph-tab ph-tab--active" />
        <span className="ph-tab" />
        <span className="ph-tab" />
      </div>
      <div className="ph-player">
        <span className="ph-art ph-art--lg" />
        <div className="ph-meta">
          <span className="ph-title ph-title--lg">Titre de la piste</span>
          <span className="ph-sub">Artiste</span>
          <span className="ph-progress">
            <span className="ph-progress-fill" />
          </span>
          <span className="ph-controls">
            <span className="ph-ctl" />
            <span className="ph-ctl ph-ctl--main" />
            <span className="ph-ctl" />
          </span>
        </div>
      </div>
    </div>
  );
}
