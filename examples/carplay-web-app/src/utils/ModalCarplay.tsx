import React from 'react'
import { FaBluetooth, FaMobileAlt } from 'react-icons/fa'
import { Oval } from 'react-loader-spinner'

interface ModalProps {
  title: string
  bluetoothText: string
  deviceName: string
  onClose: () => void
}

const Modal: React.FC<ModalProps> = ({
  title,
  bluetoothText,
  deviceName,
  onClose,
}) => {
  // CSS-in-JS styles
  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    content: {
      background: 'white',
      borderRadius: '10px',
      width: '400px',
      padding: '20px',
      textAlign: 'center' as const,
      position: 'relative' as const,
    },
    closeButton: {
      position: 'absolute' as const,
      top: '10px',
      right: '10px',
      background: 'none',
      border: 'none',
      fontSize: '20px',
      cursor: 'pointer',
    },
    title: {
      fontSize: '24px',
      marginBottom: '10px',
    },
    separator: {
      border: 'none',
      height: '1px',
      background: '#ccc',
      margin: '10px 0',
    },
    info: {
      margin: '20px 0',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '10px',
      fontSize: '18px',
    },
    icon: {
      marginRight: '10px',
      fontSize: '24px',
    },
    loading: {
      marginTop: '20px',
    },
    loadingCircle: {
      width: '50px',
      height: '50px',
      border: '5px solid #ccc',
      borderTop: '5px solid #007bff',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto',
    },
    '@keyframes spin': {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <button style={styles.closeButton} onClick={onClose}>
          &times;
        </button>
        <h2 style={styles.title}>{title}</h2>
        <hr style={styles.separator} />
        <div style={styles.info}>
          <div style={styles.row}>
            <FaBluetooth style={styles.icon} />
            <span>{bluetoothText}</span>
          </div>
          <div style={styles.row}>
            <FaMobileAlt style={styles.icon} />
            <span>{deviceName}</span>
          </div>
        </div>
        <div style={styles.loading}>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Oval
              height={50}
              width={50}
              color="#007bff"
              secondaryColor="#ccc"
              strokeWidth={2}
              strokeWidthSecondary={2}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Modal
