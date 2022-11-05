import React from 'react'
import SocialLogin from 'SocialLogin'
import closeIcon from './icons/icon.png'
import biconomyLogo from './icons/icon.svg'
import './css/index.css'

interface UIPorops {
  socialLogin: SocialLogin
}

const UI: React.FC<UIPorops> = ({ socialLogin }) => {
  return (
    <div className="container">
      <img src={closeIcon} className="closeIcon" onClick={() => socialLogin.hideWallet()} />
      <div className="textContainer">
        <h1>Biconomy Social Login</h1>
        <p>Create a wallet to continue</p>
      </div>
      <div>
        <button onClick={() => socialLogin.login()} className="googleCardStyle">
          <img src={closeIcon} style={{ marginRight: 14 }} />
          <span className="buttonTextSpan">Continue with Google</span>
        </button>
      </div>
      <div className="footer">
        <span className="footerNormalText">powered by</span>
        <img src={biconomyLogo} style={{ marginLeft: 12, marginRight: 6, width: 30 }} />
        <span className="footerBigText">Biconomy</span>
      </div>
    </div>
  )
}

export default UI
