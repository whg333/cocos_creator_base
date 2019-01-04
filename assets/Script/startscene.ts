import * as network from "./common/network/networkindex"
import http_client from "./common/network/http_client";
import * as utils from "./common/util"

const {ccclass, property} = cc._decorator;
@ccclass
export class StartScene extends cc.Component {

    onLoad() 
    {

    }

    onDestroy() 
    {

    }

    onBtnTestTouch()
    {
        // http_client.request(network.RequestAction.Hello, {Name:"leaf"}) 
        network.socket_client.connect(utils.gen_handler(()=> {
            network.socket_client.sendtest()
        }));   
    }
}
