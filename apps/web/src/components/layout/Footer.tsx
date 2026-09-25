import './Footer.css';

export function Footer() {
  return (
    <footer className="gm-footer">
      <p>© {new Date().getFullYear()} GetMaster</p>
    </footer>
  );
}
