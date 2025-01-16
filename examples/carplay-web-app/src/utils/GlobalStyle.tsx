import { createGlobalStyle } from 'styled-components'

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: 'Futura';
    src: url('/fonts/futura_light.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: 'Futura', sans-serif; /* Apply the font globally */
    color: #333; /* Optional */
  }
`

export default GlobalStyle
