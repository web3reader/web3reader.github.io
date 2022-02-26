"use strict";

/**
 * Example JavaScript code that interacts with the page and Web3 wallets
 */

 // Unpkg imports
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const Fortmatic = window.Fortmatic;
const evmChains = window.evmChains;

// Web3modal instance
let web3Modal

// Chosen wallet provider given by the dialog window
let provider;


// Address of the selected account
let selectedAccount;

// web3
let web3;

// ReaderContract
let ReaderContract;

// StoryContract
let StoryId;
let StoryName;
let StoryContractAddress;
let StoryContract;

// Chapter
let ChapterId;
let MaxChapterId;

// Chapter edit mode
let ChapterEditMode; // 1, edit, 2, create new

// the reader contract
async function initReaderContract() {
    
    //const web3 = new Web3(provider);
    web3 = new Web3(provider);
    const ReaderContractABI = await (await fetch("./reader.abi.json")).json();
    console.log("reader abi loaded");
    ReaderContract = new web3.eth.Contract(ReaderContractABI,
					   '0x91739E2F74393A89EEDd5B5a815023C2EAE4fe94');
    console.log("reader contract created");
}

// the story contract
async function initStoryContract() {
    
    //const web3 = new Web3(provider);
    web3 = new Web3(provider);
    const StoryContractABI = await (await fetch("./story.abi.json")).json();
    console.log("story abi loaded");
    StoryContract = new web3.eth.Contract(StoryContractABI,
					  StoryContractAddress);
    console.log("story contract created", StoryContractAddress);
}


/**
 * Setup the orchestra
 */
function init() {

    console.log("Initializing example");
    console.log("WalletConnectProvider is", WalletConnectProvider);
    console.log("Fortmatic is", Fortmatic);
    console.log("window.web3 is", window.web3, "window.ethereum is", window.ethereum);

    // Check that the web page is run in a secure context,
    // as otherwise MetaMask won't be available
    if(location.protocol !== 'https:') {
	// https://ethereum.stackexchange.com/a/62217/620
	const alert = document.querySelector("#alert-error-https");
	alert.style.display = "block";
	document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
	return;
    }

    // Tell Web3modal what providers we have available.
    // Built-in web browser provider (only one can exist as a time)
    // like MetaMask, Brave or Opera is added automatically by Web3modal
    const providerOptions = {
	walletconnect: {
	    package: WalletConnectProvider,
	    options: {
		// Mikko's test key - don't copy as your mileage may vary
		infuraId: "8043bb2cf99347b1bfadfb233c5325c0",
	    }
	},

	fortmatic: {
	    package: Fortmatic,
	    options: {
		// Mikko's TESTNET api key
		key: "pk_test_391E26A3B43A3350"
	    }
	}
    };

    web3Modal = new Web3Modal({
	cacheProvider: false, // optional
	providerOptions, // required
	disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
    });

    console.log("Web3Modal instance is", web3Modal);
}


/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
async function fetchAccountData() {

    await initReaderContract();
    // Get a Web3 instance for the wallet
    //const web3 = new Web3(provider);
    
    console.log("Web3 instance is", web3);
    
    // Get connected chain id from Ethereum node
    const chainId = await web3.eth.getChainId();
    // Load chain information over an HTTP API
    const chainData = evmChains.getChain(chainId);
    document.querySelector("#network-name").textContent = chainData.name;
    
    // Get list of accounts of the connected wallet
    const accounts = await web3.eth.getAccounts();
    
    // MetaMask does not give you all accounts, only the selected account
    console.log("Got accounts", accounts);
    selectedAccount = accounts[0];
    
    document.querySelector("#selected-account").textContent = selectedAccount;
    
    // Get a handl
    const template = document.querySelector("#template-balance");
    const accountContainer = document.querySelector("#accounts");
    
    // Purge UI elements any previously loaded accounts
    accountContainer.innerHTML = '';
    
    // Go through all accounts and get their ETH balance
    const rowResolvers = accounts.map(async (address) => {
	const balance = await ReaderContract.methods.balanceOf(address).call();
	// Fill in the templated row and put in the document
	const clone = template.content.cloneNode(true);
	clone.querySelector(".address").textContent = address;
	clone.querySelector(".balance").textContent = balance;
	accountContainer.appendChild(clone);
    });
    
    // Because rendering account does its own RPC commucation
    // with Ethereum node, we do not want to display any results
    // until data for all accounts is loaded
    await Promise.all(rowResolvers);
    
    // Display fully loaded UI for wallet data
    document.querySelector("#prepare").style.display = "none";
    document.querySelector("#connected").style.display = "block";
    document.querySelector("#list").style.display="block";
    document.querySelector("#create").style.display="block";
    document.querySelector("#read").style.display="block";
}



/**
 * Fetch account data for UI when
 * - User switches accounts in wallet
 * - User switches networks in wallet
 * - User connects wallet initially
 */
async function refreshAccountData() {

    // If any current data is displayed when
    // the user is switching acounts in the wallet
    // immediate hide this data
    document.querySelector("#connected").style.display = "none";
    document.querySelector("#prepare").style.display = "block";
    
    // Disable button while UI is loading.
    // fetchAccountData() will take a while as it communicates
    // with Ethereum node via JSON-RPC and loads chain data
    // over an API call.
    document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
    await fetchAccountData(provider);
    document.querySelector("#btn-connect").removeAttribute("disabled")
}


/**
 * Connect wallet button pressed.
 */
async function onConnect() {

    console.log("Opening a dialog", web3Modal);
    try {
	provider = await web3Modal.connect();
    } catch(e) {
	console.log("Could not get a wallet connection", e);
	return;
    }
    
    // Subscribe to accounts change
    provider.on("accountsChanged", (accounts) => {
	fetchAccountData();
    });
    
    // Subscribe to chainId change
    provider.on("chainChanged", (chainId) => {
	fetchAccountData();
    });
    
    // Subscribe to networkId change
    provider.on("networkChanged", (networkId) => {
	fetchAccountData();
    });
    
    await refreshAccountData();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

    console.log("Killing the wallet connection", provider);
    
    // TODO: Which providers have close method?
    if(provider.close) {
	await provider.close();
	
	// If the cached provider is not cleared,
	// WalletConnect will default to the existing session
	// and does not allow to re-scan the QR code with a new wallet.
	// Depending on your use case you may want or want not his behavir.
	await web3Modal.clearCachedProvider();
	provider = null;
    }
    
    selectedAccount = null;
    
    // Set the UI back to the initial state
    document.querySelector("#prepare").style.display = "block";
    document.querySelector("#connected").style.display = "none";
    document.querySelector("#list").style.display="none";
    document.querySelector("#create").style.display="none";
    document.querySelector("#read").style.display="none";
}


async function onListStory() {
    await initReaderContract();
    console.log("on list stories");
    // Get a handl
    const template = document.querySelector("#template-story-list");
    const storylistContainer = document.querySelector("#stories");
    
    const totalNumStories = await ReaderContract.methods.totalNumStories().call();
    
    // Purge UI elements any previously loaded storylists
    storylistContainer.innerHTML = '';
    
    for(var storyId=0; storyId < totalNumStories; storyId++) {
	const clone = template.content.cloneNode(true);
	const tmp = await ReaderContract.methods.findStoryById(storyId).call();
	clone.querySelector(".storyId").textContent = storyId;
	clone.querySelector(".storyName").textContent = tmp[0];
	clone.querySelector(".storyAddress").textContent = tmp[1];
	storylistContainer.appendChild(clone);
    }
}

async function onCreateStory() {
    await initReaderContract();
    console.log("on create story");
    const storyname = document.getElementById("createname").value;

    // Get list of accounts of the connected wallet
    const accounts = await web3.eth.getAccounts();
    
    // MetaMask does not give you all accounts, only the selected account
    console.log("Got accounts", accounts);
    selectedAccount = accounts[0];

    try {
	const storyIdTest = await ReaderContract.methods.createNewStory(storyname).call({from: selectedAccount});
	const storyId = await ReaderContract.methods.createNewStory(storyname).send({from: selectedAccount});
	console.log("created storyId", storyId);
	
    } catch(e) {
	console.log("cannot create story", e);
	document.querySelector("#failtocreate").style.display = "block";
    }
    onListStory();
}


async function onReadStory() {
    await initReaderContract();
    console.log("on read story");
    StoryId = parseInt(document.getElementById("readname").value);

    // Get list of accounts of the connected wallet
    const accounts = await web3.eth.getAccounts();
    
    // MetaMask does not give you all accounts, only the selected account
    console.log("Got accounts", accounts);
    selectedAccount = accounts[0];

    try {
	const tmp = await ReaderContract.methods.findStoryById(StoryId).call()
	StoryName = tmp[0];
	StoryContractAddress = tmp[1];
	ChapterId = 0;
	await initStoryContract();
	console.log("find story", StoryName, StoryContractAddress);

	const storyOwner = await StoryContract.methods.owner().call();
	MaxChapterId = await StoryContract.methods.maxChapter().call();;

	console.log("max chapter id", MaxChapterId);
	
	const template = document.querySelector("#template-balance");
	const accountContainer = document.querySelector("#storyaccounts");
	
	// Purge UI elements any previously loaded accounts
	accountContainer.innerHTML = '';
	
	// Go through all accounts and get their ETH balance
	const rowResolvers = accounts.map(async (address) => {
	    const balance = await StoryContract.methods.balanceOf(address).call();
	    // Fill in the templated row and put in the document
	    const clone = template.content.cloneNode(true);
	    clone.querySelector(".address").textContent = address;
	    clone.querySelector(".balance").textContent = balance;
	    accountContainer.appendChild(clone);
	});
    
	// Because rendering account does its own RPC commucation
	// with Ethereum node, we do not want to display any results
	// until data for all accounts is loaded
	await Promise.all(rowResolvers);
	
	await refreshChapter();

	
	document.querySelector("#selected-story-name").textContent = StoryName;
	document.querySelector("#selected-story-address").textContent = StoryContractAddress;
	document.querySelector("#selected-story-owner").textContent = storyOwner;
	document.querySelector("#storyaddress").style.display = "block";

	document.querySelector("#btn-share").style.display = "block";
	document.querySelector("#share-address").style.display= "none";
	document.querySelector("#btn-submit-share").style.display="none";
	
	document.querySelector("#create").style.display = "none";
	document.querySelector("#readernfttable").style.display = "none";
	document.querySelector("#storynfttable").style.display = "block";
	document.querySelector("#chapter").style.display = "block";

	if (selectedAccount == storyOwner) {
	    document.querySelector("#btn-new-chapter").style.display = "block";
	} else {
	    document.querySelector("#btn-new-chapter").style.display = "none";
	}
	
    } catch(e) {
	console.log("cannot read story", e);
	document.querySelector("#failtoread").style.display = "block";
    }
    
}

async function refreshChapter() {

    document.querySelector("#selected-chapter-id").textContent = ChapterId;
    document.querySelector("#max-chapter-id").textContent = MaxChapterId;

    var chapterText = "empty story";
    if (MaxChapterId > 0) {
	chapterText = await StoryContract.methods.readChapter(ChapterId).call();
    } 
    console.log("read chapter id", ChapterId);
    console.log(chapterText);
    document.querySelector("#selected-chapter-content").textContent = chapterText;

    const accounts = await web3.eth.getAccounts();
    console.log("Got accounts", accounts);
    selectedAccount = accounts[0];

    if(MaxChapterId > 0) {
	const chapterOwner = await StoryContract.methods.ownerOf(ChapterId).call();
	console.log(chapterOwner)
	if(chapterOwner == selectedAccount) {
	    document.querySelector("#btn-edit-chapter").style.display = "block";
	} else {
	    document.querySelector("#btn-edit-chapter").style.display = "none";
	}
    }
    document.querySelector("#edit-chapter").style.display = "none"    
    document.querySelector("#btn-submit-chapter").style.display = "none"
}

async function nextChapter() {
    ChapterId = Math.min(ChapterId + 1, MaxChapterId-1);
    await refreshChapter();
}

async function previousChapter() {
    ChapterId = Math.max(ChapterId - 1, 0);
    await refreshChapter();
}

async function gotoChapter() {
    ChapterId = Math.min(parseInt(document.getElementById("gotochapter").value), MaxChapterId-1);
    ChapterId = Math.max(ChapterId, 0);
    await refreshChapter();
}

async function enableEditChapter() {
    ChapterEditMode = 1;
    document.querySelector("#edit-chapter").style.display = "block"    
    document.querySelector("#btn-submit-chapter").style.display = "block"    
    document.querySelector("#btn-new-chapter").style.display = "none"    
}

async function enableNewChapter() {
    ChapterEditMode = 2;
    document.querySelector("#edit-chapter").style.display = "block"    
    document.querySelector("#btn-submit-chapter").style.display = "block"    
    document.querySelector("#btn-edit-chapter").style.display = "none"    
}

async function submitChapter() {
    const text = document.getElementById("edit-chapter").value;
    // Get list of accounts of the connected wallet
    const accounts = await web3.eth.getAccounts();
    
    // MetaMask does not give you all accounts, only the selected account
    console.log("Got accounts", accounts);
    selectedAccount = accounts[0];
    
    if (ChapterEditMode == 1) {
	console.log("chapter edit mode", ChapterEditMode);
	try {
	    await StoryContract.methods.writeChapter(ChapterId, text).call({from: selectedAccount});
	    await StoryContract.methods.writeChapter(ChapterId, text).send({from: selectedAccount});
	    console.log("edited chapter", ChapterId);
	} catch(e) {
	    console.log("cannot edit chapter", e);
	}
    } else if (ChapterEditMode == 2) {
	console.log("chapter edit mode", ChapterEditMode);
	try {
	    const tmp = await StoryContract.methods.newChapter(text).call({from: selectedAccount});
	    ChapterId = await StoryContract.methods.newChapter(text).send({from: selectedAccount});
	    MaxChapterId = ChapterId + 1;
	    console.log("created chapter", ChapterId);
	} catch(e) {
	    console.log("cannot create chapter", e);
	}
    }
    ChapterEditMode = 0;
    await refreshChapter();
}

async function enableShareStory() {
    document.querySelector("#share-address").style.display= "block";
    document.querySelector("#btn-submit-share").style.display="block";
}

async function submitShareStory() {
    const text = document.getElementById("share-address").value;
    var addresses = text.match(/[^\s]+/g);
    console.log("Got addresses", addresses);
    
    // Get list of accounts of the connected wallet
    const accounts = await web3.eth.getAccounts();
    
    // MetaMask does not give you all accounts, only the selected account
    console.log("Got accounts", accounts);
    selectedAccount = accounts[0];

    document.querySelector("#share-address").style.display= "none";
    document.querySelector("#btn-submit-share").style.display="none";

    try {
	await ReaderContract.methods.marketing(addresses, StoryId).call({from: selectedAccount});
	await ReaderContract.methods.marketing(addresses, StoryId).send({from: selectedAccount});	
    } catch(e) {
	console.log("cannot share story", e);
    }
}

/**
 * Main entry point.
 */
window.addEventListener('load', async () => {
    init();
    document.querySelector("#btn-connect").addEventListener("click", onConnect);
    document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
    document.querySelector("#btn-create").addEventListener("click", onCreateStory);
    document.querySelector("#btn-read").addEventListener("click", onReadStory);
    document.querySelector("#btn-list").addEventListener("click", onListStory);
    document.querySelector("#chapter-previous").addEventListener("click", previousChapter);
    document.querySelector("#chapter-goto").addEventListener("click", gotoChapter);
    document.querySelector("#chapter-next").addEventListener("click", nextChapter);

    document.querySelector("#btn-edit-chapter").addEventListener("click", enableEditChapter);
    document.querySelector("#btn-new-chapter").addEventListener("click", enableNewChapter);
    document.querySelector("#btn-submit-chapter").addEventListener("click", submitChapter);
    
    document.querySelector("#btn-share").addEventListener("click", enableShareStory);
    document.querySelector("#btn-submit-share").addEventListener("click", submitShareStory);
    
});
