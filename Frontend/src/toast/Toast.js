import { useEffect, useRef } from "react";
import "./Toast.css";

const Toast = ({ message, visible, duration = 3000, onClose }) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      onCloseRef.current?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration]);

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