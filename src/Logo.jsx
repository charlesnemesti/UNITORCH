export const LOGO_URL = '/logo.png';

export function Logo({ size = 36, showWordmark = true, className = '' }) {
  return (
    <span className={`site-logo ${className}`.trim()}>
      <img
        src={LOGO_URL}
        alt=""
        width={size}
        height={size}
        className="site-logo-mark"
        aria-hidden="true"
      />
      {showWordmark ? (
        <span className="site-logo-text">
          Uni<span className="text-fluor">Torch</span>
        </span>
      ) : null}
    </span>
  );
}
