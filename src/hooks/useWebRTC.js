import freeice from "freeice";
import { useCallback, useEffect, useRef } from "react";
import socket from "../socket";
import ACTIONS from "../socket/actions";
import useStateWithCallb from "./useStateWithCallb";

export const LOCAL_VIDEO = 'LOCAL_VIDEO'

export default function useWebRTC(roomID) {
    const [clients, updateClients] = useStateWithCallb([]);

    const addNewClient = useCallback((newClient, cb) => {
        if (!clients.includes(newClient)) {
            updateClients(list => [...list, newClient], cb);
        };
    }, [clients, updateClients]);

    const peerConnections = useRef({});
    const localMediaStream = useRef(null);
    const peerMediaElements = useRef({
        [LOCAL_VIDEO]: null,
    });

    useEffect(()=> {
        async function handleNewPeer({peerID, createOffer}) {
            if (peerID in peerConnections.current) {
                return console.warn(`Already connected to pear ${peerID}`)
            }
            peerConnections.current[peerID] = new RTCPeerConnection({
                iceServers: freeice()
            });

            peerConnections.current[peerID].onicecandidate = event => {
                if (event.candidate) {
                    socket.emit(ACTIONS.RELAY_ICE, {
                        peerID,
                        iceCandidate: event.candidate,
                    });
                }
            }

            let trackNumber = 0;
            peerConnections.current[peerID].ontrack = ({streams: [remoteStream]}) => {
                trackNumber++

                if (trackNumber === 2) {
                    addNewClient(peerID, () => {
                        peerMediaElements.current[peerID].srcObject = remoteStream;
                    });
                }
            }

            localMediaStream.current.getTracks().forEach(track => {
                peerConnections.current[peerID].addTrack(track, localMediaStream.current);
            });

            if (createOffer) {
                const offer = await peerConnections.current[peerID].createOffer();

                await peerConnections.current[peerID].setLocalDescription(offer);

                socket.emit(ACTIONS.RELAY_SDP, {
                    peerID,
                    sessionDescription: offer,
                });
            }
        }

        socket.on(ACTIONS.ADD_PEER, handleNewPeer)
    }, [])

    useEffect(() => {
    async function startCapture() {
        localMediaStream.current = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                width:1200,
                height:720,
            }
        })

        addNewClient(LOCAL_VIDEO, () => {
            const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];

            if (localVideoElement) {
                localVideoElement.volume = 0;
                localVideoElement.srcObject = localMediaStream.current;
            }
        })
    }

    startCapture()
    .then(() => socket.emit(ACTIONS.JOIN, {room: roomID}))
    .catch(e => console.error(`Error getting userMedia:`, e));

    return () => {
        localMediaStream.current.getTracks().forEach(track => track.stop())

        socket.emit(ACTIONS.LEAVE);
    }
    }, [roomID]);

    const provideMediaRef = useCallback((id, node) => {
        peerMediaElements.current[id] = node;
    }, []);

    
    return {clients, provideMediaRef};
}