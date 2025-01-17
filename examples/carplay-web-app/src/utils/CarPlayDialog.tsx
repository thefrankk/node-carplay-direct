import React from 'react'
import { Oval } from 'react-loader-spinner'
import GlobalStyle from './GlobalStyle'
import { FaFeather } from 'react-icons/fa'
import { IoMdBluetooth } from 'react-icons/io'
import { MdDevices } from 'react-icons/md'

interface CarPlayDialogProps {
  isDay: boolean
  footerText: string // New prop for footer text
  onClose: () => void
}

const CarPlayDialog: React.FC<CarPlayDialogProps> = ({
  isDay,
  onClose,
  footerText,
}) => {
  const backgroundColor = isDay ? '#FFFFFF' : '#1C1C1C'
  const titleColor = isDay ? '#000000' : '#FFFFFF'
  const textColor = isDay ? '#000000' : '#FFFFFF'
  const iconColor = isDay ? '#007BFF' : '#87CEEB'

  const styles = {
    dialogOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 32,
    },
    dialogBox: {
      backgroundColor: backgroundColor,
      borderRadius: '15px',
      width: '300px',
      padding: '20px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    },
    title: {
      textAlign: 'center' as const,
      fontSize: '22px',
      color: titleColor,
    },
    divider: {
      margin: '30px 0',
      height: '1px',
      backgroundColor: isDay ? '#00000033' : '#666666',
    },
    row: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '35px',
    },
    icon: {
      fontSize: '25px',
      color: iconColor,
      marginRight: '10px',
    },
    text: {
      fontSize: '18px',
      color: textColor,
    },
    boldText: {
      fontSize: '18px',
      fontWeight: 'bold' as const,
      color: textColor,
    },
    loader: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '50px',
    },
    cancelButton: {
      display: 'block',
      textAlign: 'center' as const,
      color: 'red',
      fontSize: '18px',
      cursor: 'pointer',
    },
    footerText: {
      fontSize: '16px',
      color: isDay ? '#555' : '#aaa',
      marginTop: '15px',
    },
  }

  return (
    <>
      <GlobalStyle />
      <div style={styles.dialogOverlay}>
        <div style={styles.dialogBox}>
          <h2 style={styles.title}>Apple CarPlay</h2>
          <div style={styles.divider}></div>
          <div style={styles.row}>
            <IoMdBluetooth style={styles.icon} size={25} color={iconColor} />
            <span style={styles.text}>Connect via Bluetooth to</span>
          </div>
          <div style={styles.row}>
            <MdDevices style={styles.icon} size={25} color={iconColor} />
            <span style={styles.boldText}>AutoKit-5a7e</span>
          </div>
          <div style={styles.loader}>
            <Oval
              height={50}
              width={50}
              color={iconColor}
              secondaryColor="#ccc"
              strokeWidth={5}
              strokeWidthSecondary={2}
            />
          </div>
          <div style={styles.footerText}>{footerText}</div>{' '}
          {/* Footer Text from Prop */}
          {/* Added text */}
        </div>
      </div>
    </>
  )
}

export default CarPlayDialog
