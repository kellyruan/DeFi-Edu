import WalletConnectProvider from "@walletconnect/web3-provider";
import WalletLink from "walletlink";
import { Alert, Button, Col, Menu, Row } from "antd";
import "antd/dist/antd.css";
import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Switch } from "react-router-dom";
import Web3Modal from "web3modal";
import "./App.css";
import { Account, Contract, Faucet, GasGauge, Header, Ramp, ThemeSwitch } from "./components";
import { INFURA_ID, NETWORK, NETWORKS } from "./constants";
import { Transactor } from "./helpers";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { useEventListener } from "eth-hooks/events/useEventListener";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import { ExampleUI, Hints, Subgraph } from "./views";

import deployedContracts from "./contracts/hardhat_contracts.json";
import externalContracts from "./contracts/external_contracts";

import { useContractConfig } from "./hooks";
import Portis from "@portis/web3";
import Fortmatic from "fortmatic";
import Authereum from "authereum";

import fs from 'fs';
import { NFTStorage, File } from 'nft.storage';

import Dropzone from 'react-dropzone';

import capture1 from'./Capture1.PNG';

const endpoint = 'https://api.nft.storage';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweEI3NkMyMUY5MGNiOTc1MjVDN2QxNzcwNkE4MDA1RjJiMDFlNzdkRDkiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTYzNTAyNzc0OTg5MiwibmFtZSI6InRlc3QifQ.fKYFsDamlkF-bhbqjDf36D8W9y4xEmnn1reOyldiYxc';

const { ethers } = require("ethers");

const targetNetwork = NETWORKS.localhost;

const DEBUG = true;
const NETWORKCHECK = true;

if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");

const scaffoldEthProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://rpc.scaffoldeth.io:48544")
  : null;
const poktMainnetProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider(
      "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
    )
  : null;
const mainnetInfura = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID)
  : null;

const localProviderUrl = targetNetwork.rpcUrl;
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv);

const blockExplorer = targetNetwork.blockExplorer;

const walletLink = new WalletLink({
  appName: "coinbase",
});

const walletLinkProvider = walletLink.makeWeb3Provider(`https://mainnet.infura.io/v3/${INFURA_ID}`, 1);

const web3Modal = new Web3Modal({
  network: "mainnet", // Optional. If using WalletConnect on xDai, change network to "xdai" and add RPC info below for xDai chain.
  cacheProvider: true, // optional
  theme: "light", // optional. Change to "dark" for a dark theme.
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        bridge: "https://polygon.bridge.walletconnect.org",
        infuraId: INFURA_ID,
        rpc: {
          1: `https://mainnet.infura.io/v3/${INFURA_ID}`, // mainnet // For more WalletConnect providers: https://docs.walletconnect.org/quick-start/dapps/web3-provider#required
          42: `https://kovan.infura.io/v3/${INFURA_ID}`,
          100: "https://dai.poa.network", // xDai
        },
      },
    },
    portis: {
      display: {
        logo: "https://user-images.githubusercontent.com/9419140/128913641-d025bc0c-e059-42de-a57b-422f196867ce.png",
        name: "Portis",
        description: "Connect to Portis App",
      },
      package: Portis,
      options: {
        id: "6255fb2b-58c8-433b-a2c9-62098c05ddc9",
      },
    },
    fortmatic: {
      package: Fortmatic, // required
      options: {
        key: "pk_live_5A7C91B2FC585A17", // required
      },
    },
    // torus: {
    //   package: Torus,
    //   options: {
    //     networkParams: {
    //       host: "https://localhost:8545", // optional
    //       chainId: 1337, // optional
    //       networkId: 1337 // optional
    //     },
    //     config: {
    //       buildEnv: "development" // optional
    //     },
    //   },
    // },
    "custom-walletlink": {
      display: {
        logo: "https://play-lh.googleusercontent.com/PjoJoG27miSglVBXoXrxBSLveV6e3EeBPpNY55aiUUBM9Q1RCETKCOqdOkX2ZydqVf0",
        name: "Coinbase",
        description: "Connect to Coinbase Wallet (not Coinbase App)",
      },
      package: walletLinkProvider,
      connector: async (provider, _options) => {
        await provider.enable();
        return provider;
      },
    },
    authereum: {
      package: Authereum, // required
    },
  },
});

function App(props) {
  const mainnetProvider =
    poktMainnetProvider && poktMainnetProvider._isProvider
      ? poktMainnetProvider
      : scaffoldEthProvider && scaffoldEthProvider._network
      ? scaffoldEthProvider
      : mainnetInfura;

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);
  const gasPrice = useGasPrice(targetNetwork, "fast");
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider);
  const userSigner = userProviderAndSigner.signer;

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  const tx = Transactor(userSigner, gasPrice);

  const faucetTx = Transactor(localProvider, gasPrice);

  const yourLocalBalance = useBalance(localProvider, address);

  const yourMainnetBalance = useBalance(mainnetProvider, address);

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };

  const readContracts = useContractLoader(localProvider, contractConfig);

  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  const purpose = useContractReader(readContracts, "YourContract", "purpose");

  const setPurposeEvents = useEventListener(readContracts, "YourContract", "SetPurpose", localProvider, 1);

    function droppedFiles() {
        setRoute("/2");
    }
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetContracts);
      console.log("💵 yourMainnetDAIBalance", myMainnetDAIBalance);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetContracts,
  ]);

  let networkDisplay = "";
  if (NETWORKCHECK && localChainId && selectedChainId && localChainId !== selectedChainId) {
    const networkSelected = NETWORK(selectedChainId);
    const networkLocal = NETWORK(localChainId);
    if (selectedChainId === 1337 && localChainId === 31337) {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network ID"
            description={
              <div>
                You have <b>chain id 1337</b> for localhost and you need to change it to <b>31337</b> to work with
                HardHat.
                <div>(MetaMask -&gt; Settings -&gt; Networks -&gt; Chain ID -&gt; 31337)</div>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    } else {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network"
            description={
              <div>
                You have <b>{networkSelected && networkSelected.name}</b> selected and you need to be on{" "}
                <Button
                  onClick={async () => {
                    const ethereum = window.ethereum;
                    const data = [
                      {
                        chainId: "0x" + targetNetwork.chainId.toString(16),
                        chainName: targetNetwork.name,
                        nativeCurrency: targetNetwork.nativeCurrency,
                        rpcUrls: [targetNetwork.rpcUrl],
                        blockExplorerUrls: [targetNetwork.blockExplorer],
                      },
                    ];
                    console.log("data", data);

                    let switchTx;
                    // https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods
                    try {
                      switchTx = await ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: data[0].chainId }],
                      });
                    } catch (switchError) {
                      // not checking specific error code, because maybe we're not using MetaMask
                      try {
                        switchTx = await ethereum.request({
                          method: "wallet_addEthereumChain",
                          params: data,
                        });
                      } catch (addError) {
                        // handle "add" error
                      }
                    }

                    if (switchTx) {
                      console.log(switchTx);
                    }
                  }}
                >
                  <b>{networkLocal && networkLocal.name}</b>
                </Button>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    }
  } else {
    networkDisplay = (
      <div style={{ zIndex: -1, position: "absolute", right: 154, top: 28, padding: 16, color: targetNetwork.color }}>
        {targetNetwork.name}
      </div>
    );
  }

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (
    !faucetClicked &&
    localProvider &&
    localProvider._network &&
    localProvider._network.chainId === 31337 &&
    yourLocalBalance &&
    ethers.utils.formatEther(yourLocalBalance) <= 0
  ) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: ethers.utils.parseEther("0.01"),
            });
            setFaucetClicked(true);
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  function droppedFile(files) {
      const storage = new NFTStorage({ endpoint, token })
      const metadata = storage.store({
        name: 'nft.storage store test',
        description:
          'Using the nft.storage metadata API to create ERC-1155 compatible metadata.',
        image: new File([fs.promises.readFile(files[0])], 'download.png', {
          type: 'image/jpg',
        }),
      })
      console.log('IPFS URL for the metadata:', metadata.url)
      console.log('metadata.json contents:\n', metadata.data)
      console.log(
        'metadata.json contents with IPFS gateway URLs:\n',
        metadata.embed()
      )
    }

  return (
    <div className="App">
      <Header />
      <BrowserRouter>
        <Switch>
          <Route exact path="/">
            <Contract
              name="YourContract"
              signer={userSigner}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              contractConfig={contractConfig}
            />
          </Route>
          <Route path="/hints">
            <Hints
              address={address}
              yourLocalBalance={yourLocalBalance}
              mainnetProvider={mainnetProvider}
              price={price}
            />
          </Route>
          <Route path="/exampleui">
            <ExampleUI
              address={address}
              userSigner={userSigner}
              mainnetProvider={mainnetProvider}
              localProvider={localProvider}
              yourLocalBalance={yourLocalBalance}
              price={price}
              tx={tx}
              writeContracts={writeContracts}
              readContracts={readContracts}
              purpose={purpose}
              setPurposeEvents={setPurposeEvents}
            />
          </Route>
          <Route path="/mainnetdai">
            <Contract
              name="DAI"
              customContract={mainnetContracts && mainnetContracts.contracts && mainnetContracts.contracts.DAI}
              signer={userSigner}
              provider={mainnetProvider}
              address={address}
              blockExplorer="https://etherscan.io/"
              contractConfig={contractConfig}
              chainId={1}
            />
          </Route>
          <Route path="/subgraph">
            <Subgraph
              subgraphUri={props.subgraphUri}
              tx={tx}
              writeContracts={writeContracts}
              mainnetProvider={mainnetProvider}
            />
          </Route>
          <Route path="/q1">
              <Menu style={{ paddingTop: "3%", position: "fixed", top: "10%", right: "0px", height: "700px", fontSize: "20px", textAlign: "center", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={[route]} mode="vertical">
                <Menu.Item key="/q1">
                  <Link onClick={() => {setRoute("/q1");}} to="/q1">Question 1</Link>
                </Menu.Item>
                <Menu.Item key="/q2">
                  <Link onClick={() => {setRoute("/q2");}} to="/q2">Question 2</Link>
                </Menu.Item>
                <Menu.Item key="/q3">
                  <Link onClick={() => {setRoute("/q3");}} to="/q3">Question 3</Link>
                </Menu.Item>
                <Menu.Item key="/q4">
                  <Link onClick={() => {setRoute("/q3");}} to="/q4">Question 4</Link>
                </Menu.Item>
                <Menu.Item key="/1">
                  <Link onClick={() => {setRoute("/1");}} to="/1">Interactive Exercise</Link>
                </Menu.Item>
              </Menu>

              <Menu style={{ paddingLeft: '30px', paddingTop: "3%", position: "fixed", top: "10%", left: "0px", height: "700px", fontSize: "20px", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={["/nfts"]} mode="vertical">
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Home</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Progress</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Topics</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Tokens</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Community</Link>
                </Menu.Item>
              </Menu>
            <div style={{ position: "fixed", top: "20%", left: "25%", width: '800px'}}>
                <h1 style={{fontSize:'35px', marginBottom:'20px'}}> What is not a component of a blockchain? </h1>
                <button type="button" style={{position: "fixed", top: "32%", left: "33%", fontSize:'35px', height:"150px", width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>Data</button>
                <button type="button" style={{position: "fixed", top: "32%", left: "52%", fontSize:'35px', height:"150px", width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>Hash</button>
                <br />
                <button type="button" style={{position: "fixed", top: "57%", left: "33%", fontSize:'35px', height:"150px", width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>Previous hashes</button>
                <button type="button" style={{position: "fixed", top: "57%", left: "52%",  fontSize:'35px', height:"150px", width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>Access Code</button>
                <Link onClick={() => {setRoute("/q1.5");}} style={{color:"white"}} to="/q1.5"><button type="button" style={{position: "fixed", top: "83%", left: "41%", fontSize:'20px', height:"50px", marginBottom:'3%', width:'250px', borderRadius:'5%', background:'lightgreen', border:'none', boxShadow:'0px 2px lightgreen'}}>Check</button></Link>
            </div>
          </Route>
          <Route path="/q1.5">
              <Menu style={{ paddingTop: "3%", position: "fixed", top: "10%", right: "0px", height: "700px", fontSize: "20px", textAlign: "center", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={[route]} mode="vertical">
                <Menu.Item key="/q1">
                  <Link onClick={() => {setRoute("/q1");}} to="/q1">Question 1</Link>
                </Menu.Item>
                <Menu.Item key="/q2">
                  <Link onClick={() => {setRoute("/q2");}} to="/q2">Question 2</Link>
                </Menu.Item>
                <Menu.Item key="/q3">
                  <Link onClick={() => {setRoute("/q3");}} to="/q3">Question 3</Link>
                </Menu.Item>
                <Menu.Item key="/q4">
                  <Link onClick={() => {setRoute("/q3");}} to="/q4">Question 4</Link>
                </Menu.Item>
                <Menu.Item key="/1">
                  <Link onClick={() => {setRoute("/1");}} to="/1">Interactive Exercise</Link>
                </Menu.Item>
              </Menu>

              <Menu style={{ paddingLeft: '30px', paddingTop: "3%", position: "fixed", top: "10%", left: "0px", height: "700px", fontSize: "20px", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={["/nfts"]} mode="vertical">
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Home</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Progress</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Topics</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Tokens</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Community</Link>
                </Menu.Item>
              </Menu>
            <div style={{ position: "fixed", top: "20%", left: "23%"}}>
                <h1 style={{fontSize:'35px', marginTop:'100px', marginBottom:'50px'}}> That's correct! </h1>
                <h2 style={{width: '800px', fontSize:'35px', marginBottom:'60px'}}> Data, hashes, and previous hashes are all components of a blockchain. </h2>
                <Link onClick={() => {setRoute("/1");}} style={{color:"white"}} to="/1"><button type="button" style={{fontSize:'20px', height:"50px", marginBottom:'3%', width:'250px', borderRadius:'5%', background:'lightgreen', border:'none', boxShadow:'0px 2px lightgreen'}}>Interactive Exercise</button></Link>
            </div>
          </Route>
          <Route path="/q2">
              <Menu style={{ textAlign: "center", width: "25%", marginLeft: "75%" }} selectedKeys={[route]} mode="vertical">
                <Menu.Item key="/">
                  <Link
                    onClick={() => {
                      setRoute("/");
                    }}
                    to="/"
                  >
                    YourContract
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q1">
                  <Link
                    onClick={() => {
                      setRoute("/q1");
                    }}
                    to="/q1"
                  >
                    q1
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q1.5">
                  <Link
                    onClick={() => {
                      setRoute("/q1.5");
                    }}
                    to="/q1.5"
                  >
                    q1.5
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q2">
                  <Link
                    onClick={() => {
                      setRoute("/q2");
                    }}
                    to="/q2"
                  >
                    q2
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q2.5">
                  <Link
                    onClick={() => {
                      setRoute("/q2.5");
                    }}
                    to="/q2.5"
                  >
                    q2.5
                  </Link>
                </Menu.Item>
                <Menu.Item key="/1">
                  <Link
                    onClick={() => {
                      setRoute("/1");
                    }}
                    to="/1"
                  >
                    1
                  </Link>
                </Menu.Item>
                <Menu.Item key="/2">
                  <Link
                    onClick={() => {
                      setRoute("/2");
                    }}
                    to="/2"
                  >
                    2
                  </Link>
                </Menu.Item>
                <Menu.Item key="/3">
                  <Link
                    onClick={() => {
                      setRoute("/3");
                    }}
                    to="/3"
                  >
                    3
                  </Link>
                </Menu.Item>
              </Menu>

              <Menu style={{ textAlign: "center", width: "25%", marginLeft: "0%", marginTop: "-20%" }} selectedKeys={["/nfts"]} mode="vertical">
                <Menu.Item key="/">
                  <Link
                    onClick={() => {
                      setRoute("/");
                    }}
                    to="/"
                  >
                    Tracks
                  </Link>
                </Menu.Item>
                <Menu.Item key="/nfts">
                  <Link
                    onClick={() => {
                      setRoute("/nfts");
                    }}
                    to="/nfts"
                  >
                    NFTs
                  </Link>
                </Menu.Item>
                <Menu.Item key="/blockchain">
                  <Link
                    onClick={() => {
                      setRoute("/blockchain");
                    }}
                    to="/blockchain"
                  >
                    Blockchain
                  </Link>
                </Menu.Item>

              </Menu>
              <div style={{ marginTop: "-10%"}}>
                  <h1 style={{fontSize:'35px', marginBottom:'15px'}}> How does adding a block affect the chain? </h1>
                  <button type="button" style={{fontSize:'30px', height:"150px", marginLeft:'10%', marginRight:'10%', marginBottom:'3%', width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>It does not change anything</button>
                  <button type="button" style={{fontSize:'30px', height:"150px", marginRight:'10%', marginBottom:'3%', width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>It adds a new hash</button>
                  <br />
                  <button type="button" style={{fontSize:'30px', height:"150px", marginLeft:'10%', marginRight:'10%', marginBottom:'3%', width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>It changes access to the chain</button>
                  <button type="button" style={{fontSize:'30px', height:"150px", marginRight:'10%', marginBottom:'3%', width:'250px', borderRadius:'10%', border:'solid', borderColor:'lightgray', boxShadow:'0px 2px gray'}}>It breaks the chain</button>
                  <br />
                  <Link onClick={() => {setRoute("/q1.5");}} style={{color:"white"}} to="/q1.5"><button type="button" style={{fontSize:'20px', height:"50px", marginBottom:'3%', width:'250px', borderRadius:'5%', background:'lightgreen', border:'none', boxShadow:'0px 2px lightgreen'}}>Check</button></Link>
              </div>
          </Route>
          <Route path="/q2.5">
              <Menu style={{ textAlign: "center", width: "25%", marginLeft: "75%" }} selectedKeys={[route]} mode="vertical">
                <Menu.Item key="/">
                  <Link
                    onClick={() => {
                      setRoute("/");
                    }}
                    to="/"
                  >
                    YourContract
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q1">
                  <Link
                    onClick={() => {
                      setRoute("/q1");
                    }}
                    to="/q1"
                  >
                    q1
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q1.5">
                  <Link
                    onClick={() => {
                      setRoute("/q1.5");
                    }}
                    to="/q1.5"
                  >
                    q1.5
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q2">
                  <Link
                    onClick={() => {
                      setRoute("/q2");
                    }}
                    to="/q2"
                  >
                    q2
                  </Link>
                </Menu.Item>
                <Menu.Item key="/q2.5">
                  <Link
                    onClick={() => {
                      setRoute("/q2.5");
                    }}
                    to="/q2.5"
                  >
                    q2.5
                  </Link>
                </Menu.Item>
                <Menu.Item key="/1">
                  <Link
                    onClick={() => {
                      setRoute("/1");
                    }}
                    to="/1"
                  >
                    1
                  </Link>
                </Menu.Item>
                <Menu.Item key="/2">
                  <Link
                    onClick={() => {
                      setRoute("/2");
                    }}
                    to="/2"
                  >
                    2
                  </Link>
                </Menu.Item>
                <Menu.Item key="/3">
                  <Link
                    onClick={() => {
                      setRoute("/3");
                    }}
                    to="/3"
                  >
                    3
                  </Link>
                </Menu.Item>
              </Menu>

              <Menu style={{ textAlign: "center", width: "25%", marginLeft: "0%", marginTop: "-20%" }} selectedKeys={["/nfts"]} mode="vertical">
                <Menu.Item key="/">
                  <Link
                    onClick={() => {
                      setRoute("/");
                    }}
                    to="/"
                  >
                    Tracks
                  </Link>
                </Menu.Item>
                <Menu.Item key="/nfts">
                  <Link
                    onClick={() => {
                      setRoute("/nfts");
                    }}
                    to="/nfts"
                  >
                    NFTs
                  </Link>
                </Menu.Item>
                <Menu.Item key="/blockchain">
                  <Link
                    onClick={() => {
                      setRoute("/blockchain");
                    }}
                    to="/blockchain"
                  >
                    Blockchain
                  </Link>
                </Menu.Item>

              </Menu>
            <h1 style={{fontSize:'35px', marginBottom:'15px'}}> Sorry, that's incorrect! </h1>
            <Link
              onClick={() => {
                setRoute("/q2.5");
              }}
              to="/q2.5"
            >
              Next Question
            </Link>
          </Route>
          <Route path="/1">
              <Menu style={{ paddingTop: "3%", position: "fixed", top: "10%", right: "0px", height: "700px", fontSize: "20px", textAlign: "center", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={[route]} mode="vertical">
                <Menu.Item key="/q1">
                  <Link onClick={() => {setRoute("/q1");}} to="/q1">Question 1</Link>
                </Menu.Item>
                <Menu.Item key="/q2">
                  <Link onClick={() => {setRoute("/q2");}} to="/q2">Question 2</Link>
                </Menu.Item>
                <Menu.Item key="/q3">
                  <Link onClick={() => {setRoute("/q3");}} to="/q3">Question 3</Link>
                </Menu.Item>
                <Menu.Item key="/q4">
                  <Link onClick={() => {setRoute("/q3");}} to="/q4">Question 4</Link>
                </Menu.Item>
                <Menu.Item key="/1">
                  <Link onClick={() => {setRoute("/1");}} to="/1">Interactive Exercise</Link>
                </Menu.Item>
              </Menu>

              <Menu style={{ paddingLeft: '30px', paddingTop: "3%", position: "fixed", top: "10%", left: "0px", height: "700px", fontSize: "20px", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={["/nfts"]} mode="vertical">
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Home</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Progress</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Topics</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Tokens</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Community</Link>
                </Menu.Item>
              </Menu>
             <div style={{ position: "fixed", top: "20%", left: "28%", width: "700px"}}>
                <div style={{paddingTop:'30px', paddingBottom:'30px', paddingLeft:'50px', paddingRight: '50px', borderRadius:'15%', marginBottom:'50px', backgroundColor:'#E5F6E5'}}>
                    <h1 style={{marginBottom:'40px', marginTop:'30px'}}> Minting your first NFT! </h1>
                    <h2 style={{marginBottom:'40px'}}> Let's get started on minting your very own NFT! NFTs can be anything from digital art to digital collectibles. Start by uploading a picture below.</h2>
                    <h3 style={{marginBottom:'30px'}}> !! Remember that anything on the blockchain is visible to anyone so don't upload anything personal! </h3>
                </div>
                <Link onClick={() => {setRoute("/2");}} to="/2">
                    <Dropzone onDrop={acceptedFiles => droppedFiles()}>
                        {({getRootProps, getInputProps}) => (
                          <section>
                            <div {...getRootProps()} className="drop">
                              <input {...getInputProps()} />
                              <p><span style={{textDecoration: "underline", fontSize:'30px'}}>Upload file here</span></p>
                            </div>
                          </section>
                        )}
                      </Dropzone>
                </Link>
            </div>
          </Route>
          <Route path="/2">
              <Menu style={{ paddingTop: "3%", position: "fixed", top: "10%", right: "0px", height: "700px", fontSize: "20px", textAlign: "center", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={[route]} mode="vertical">
                <Menu.Item key="/q1">
                  <Link onClick={() => {setRoute("/q1");}} to="/q1">Question 1</Link>
                </Menu.Item>
                <Menu.Item key="/q2">
                  <Link onClick={() => {setRoute("/q2");}} to="/q2">Question 2</Link>
                </Menu.Item>
                <Menu.Item key="/q3">
                  <Link onClick={() => {setRoute("/q3");}} to="/q3">Question 3</Link>
                </Menu.Item>
                <Menu.Item key="/q4">
                  <Link onClick={() => {setRoute("/q3");}} to="/q4">Question 4</Link>
                </Menu.Item>
                <Menu.Item key="/1">
                  <Link onClick={() => {setRoute("/1");}} to="/1">Interactive Exercise</Link>
                </Menu.Item>
              </Menu>

              <Menu style={{ paddingLeft: '30px', paddingTop: "3%", position: "fixed", top: "10%", left: "0px", height: "700px", fontSize: "20px", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={["/nfts"]} mode="vertical">
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Home</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Progress</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Topics</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Tokens</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Community</Link>
                </Menu.Item>
              </Menu>
              <div style={{ position: "fixed", top: "20%", left: "28%", width: "700px"}}>
                  <div style={{paddingTop:'30px', paddingBottom:'30px', paddingLeft:'50px', paddingRight: '50px', borderRadius:'15%', marginBottom:'50px', backgroundColor:'#E5F6E5'}}>
                      <h1 style={{marginBottom:'40px', marginTop:'30px'}}> Congrats on your first NFT! </h1>
                      <h2 style={{marginBottom:'40px'}}> Your NFT is on the blockchain! Anyone can access your NFT with its CID but only you own it! You can update it at anytime.</h2>
                      <h3 style={{marginBottom:'30px'}}> Below is the CID for your NFT: bafkreih7fvelv4tbr5wuti6hufjkw5yiqtckfsvuuiikwhmgoeq77vlagu</h3>
                  </div>
                  <Link style={{fontSize:'30px', color:'black'}} onClick={() => {setRoute("/3");}} to="/3"><button type="button" style={{fontSize:'30px', height:"50px", marginBottom:'3%', width:'250px', borderRadius:'20%', backgroundColor:'#E5F6E5', border:'none'}}>View NFT</button></Link>
            </div>
          </Route>
          <Route path="/3">
              <Menu style={{ paddingTop: "3%", position: "fixed", top: "10%", right: "0px", height: "700px", fontSize: "20px", textAlign: "center", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={[route]} mode="vertical">
                <Menu.Item key="/q1">
                  <Link onClick={() => {setRoute("/q1");}} to="/q1">Question 1</Link>
                </Menu.Item>
                <Menu.Item key="/q2">
                  <Link onClick={() => {setRoute("/q2");}} to="/q2">Question 2</Link>
                </Menu.Item>
                <Menu.Item key="/q3">
                  <Link onClick={() => {setRoute("/q3");}} to="/q3">Question 3</Link>
                </Menu.Item>
                <Menu.Item key="/q4">
                  <Link onClick={() => {setRoute("/q3");}} to="/q4">Question 4</Link>
                </Menu.Item>
                <Menu.Item key="/1">
                  <Link onClick={() => {setRoute("/1");}} to="/1">Interactive Exercise</Link>
                </Menu.Item>
              </Menu>

              <Menu style={{ paddingLeft: '30px', paddingTop: "3%", position: "fixed", top: "10%", left: "0px", height: "700px", fontSize: "20px", width: "15%", backgroundColor: "#B9EEFF" }} selectedKeys={["/nfts"]} mode="vertical">
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Home</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Progress</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Topics</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Tokens</Link>
                </Menu.Item>
                <Menu.Item key="/">
                  <Link onClick={() => {setRoute("/");}} to="/">Community</Link>
                </Menu.Item>
              </Menu>
            <img style={{marginTop:'7%', width:'30%', height:'30%'}}src="https://bafkreih7fvelv4tbr5wuti6hufjkw5yiqtckfsvuuiikwhmgoeq77vlagu.ipfs.dweb.link/"/>
          </Route>
          <Route path="/tracks">
            <div style={{textAlign:"left", marginLeft:"20%", marginTop:'2%'}}>
                <h1> Blockchain </h1>
                <img style={{width:'800px'}} src={capture1}/>
                <h1 style={{marginTop:"3%"}}> Non-Fungible Tokens </h1>
                <Link style={{color:'black'}} onClick={() => {setRoute("/q1");}} to="/q1"><img style={{width:'800px'}} src={capture1}/></Link>
                <h1 style={{marginTop:"3%"}}> Decentralized Exchanges </h1>
                <button style={{height:"150px", marginRight:'10%', width:'150px', borderRadius:'10%', background:'gold', border:'none'}}> Beginner 1 </button>
                <button style={{height:"150px", marginRight:'10%', width:'150px', borderRadius:'10%', background:'green', border:'none'}}> Beginner 2 </button>
                <button style={{height:"150px", marginRight:'10%', width:'150px', borderRadius:'10%', background:'green', border:'none'}}> Beginner 3 </button>
                <button style={{height:"150px", width:'150px', borderRadius:'10%', background:'blue', border:'none'}}> Intermediate 1 </button>
                <h1 style={{marginTop:"5%"}}> Protocols </h1>
                <button style={{height:"150px", marginRight:'10%', width:'150px', borderRadius:'10%', background:'gold', border:'none'}}> Beginner 1 </button>
                <button style={{height:"150px", marginRight:'10%', width:'150px', borderRadius:'10%', background:'green', border:'none'}}> Beginner 2 </button>
                <button style={{height:"150px", marginRight:'10%', width:'150px', borderRadius:'10%', background:'green', border:'none'}}> Beginner 3 </button>
                <button style={{height:"150px", width:'150px', borderRadius:'10%', background:'blue', border:'none'}}> Intermediate 1 </button>
            </div>
          </Route>
        </Switch>
      </BrowserRouter>

      <ThemeSwitch />

      <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#C4C4C4", position: "fixed", textAlign: "right", right: "25px", top: "15px", padding: "4px" }}>
        <h2> CH </h2>
      </div>

      <div style={{ width: "150px", height: "30px", backgroundColor: "#C4C4C4", position: "fixed", textAlign: "center", right: "95px", top: "20px" }}>
        <h2> Tokens: 10 </h2>
      </div>

      <div style={{ width: "300px", height: "30px", borderRadius: "25%", backgroundColor: "white", position: "fixed", textAlign: "center", right: "42%", top: "20px"}}>
        <h2> Search </h2>
      </div>

      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>
      </div>

    </div>
  );
}

export default App;
