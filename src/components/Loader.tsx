import styled, { keyframes } from 'styled-components';

// Keyframes definition
const ballL53 = keyframes`
  0%, 50% { transform: rotate(0) translateX(0); }
  100% { transform: rotate(50deg) translateX(-2.5em); }
`;

const ballR53 = keyframes`
  0%, 50% { transform: rotate(0) translateX(0); }
  100% { transform: rotate(-50deg) translateX(2.5em); }
`;

const shadowLN53 = keyframes`
  0%, 50% { transform: rotate(0) translateX(0); }
  100% { transform: rotate(25deg) translateX(-1.25em); }
`;

const shadowRN53 = keyframes`
  0%, 50% { transform: rotate(0) translateX(0); }
  100% { transform: rotate(-25deg) translateX(1.25em); }
`;

const StyledLoaderWrapper = styled.div`
  /* Base styles for centering and font size */
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 1rem; /* Base for em units */

  .swing {
    display: flex; /* Using flex instead of float */
    justify-content: center;
    align-items: center;
  }

  .swing div {
    border-radius: 50%;
    height: 1em;
    width: 1em;
    margin: 0 0.1em; /* Spacing between balls */
  }

  .swing div:nth-of-type(1) { background: linear-gradient(to right, #385c78 0%, #325774 100%); }
  .swing div:nth-of-type(2) { background: linear-gradient(to right, #325774 0%, #47536a 100%); }
  .swing div:nth-of-type(3) { background: linear-gradient(to right, #47536a 0%, #4f4f5e 100%); }
  .swing div:nth-of-type(4) { background: linear-gradient(to right, #4f4f5e 0%, #624850 100%); }
  .swing div:nth-of-type(5) { background: linear-gradient(to right, #624850 0%, #783f41 100%); }
  .swing div:nth-of-type(6) { background: linear-gradient(to right, #783f41 0%, #a03231 100%); }
  .swing div:nth-of-type(7) { background: linear-gradient(to right, #a03231 0%, #d92525 100%); }

  .swing-l {
    animation: ${ballL53} 0.425s ease-in-out infinite alternate;
  }
  .swing-r {
    animation: ${ballR53} 0.425s ease-in-out infinite alternate;
  }

  .shadow {
    display: flex; /* Using flex instead of float + clear */
    justify-content: center;
    align-items: center;
    padding-top: 1.5em; /* Original padding-top */
  }

  .shadow div {
    filter: blur(1px);
    width: 1em;
    height: 0.25em;
    border-radius: 50%;
    background: #c0c0c0; /* Adjusted from #e3dbd2 */
    margin: 0 0.1em; /* Spacing between shadow elements */
  }

  .shadow-l {
    background: #b0b0b0; /* Adjusted from #d5d8d6 */
    animation: ${shadowLN53} 0.425s ease-in-out infinite alternate;
  }

  .shadow-r {
    background: #d0b0a0; /* Adjusted from #eed3ca */
    animation: ${shadowRN53} 0.425s ease-in-out infinite alternate;
  }
`;

const Loader = () => {
  return (
    <StyledLoaderWrapper aria-busy="true" aria-label="Loading" role="progressbar">
      <div className="swing">
        <div className="swing-l"></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div className="swing-r"></div>
      </div>
      <div className="shadow">
        <div className="shadow-l"></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div className="shadow-r"></div>
      </div>
    </StyledLoaderWrapper>
  );
};

export default Loader;
