import { useEffect } from "react";
import "./Toast.css";

const Toast = ({ message, visible, duration = 3000, onClose }) => {
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible) return null;

  return (
    <div className="toast-container">
      <div className="toast">
        {message}
      </div>
    </div>
  );
};

export default Toast;