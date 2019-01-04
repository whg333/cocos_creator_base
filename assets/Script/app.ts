
// import * as Generator from './algo/levelgenerator'
import * as utils from "./common/util"
import {event_mgr, Event_Name} from "./common/event/event_mgr"
import {appdata} from "./appdata"
import {TimerMgr} from "./common/timer/timer_mgr"
import {pop_mgr, UI_CONFIG} from "./common/ui/pop_mgr"
import * as Audio from "./common/audio/audioplayer"
import * as Consts from "./consts"
import { loader_mgr } from "./common/loader/loader_mgr"
import * as network from "./common/network/networkindex"
import http_client from "./common/network/http_client";

const {ccclass, property} = cc._decorator;
@ccclass

/*首场景首节点首个用户组件。可用于程序初始化及公共事件监听**/
export class App extends cc.Component 
{ 
    onLoad()
    {
        // 设置为全局节点, 跳转场景不释放
        cc.game.addPersistRootNode(this.node);
        // cc.game.setFrameRate(60);

        //设置钩子函数
        // pop_mgr.get_inst().set_handlers(utils.gen_handler(() => {
        //     event_mgr.get_inst().fire(Event_Name.UI_SHOW);
        // }), utils.gen_handler(() => {
        //     event_mgr.get_inst().fire(Event_Name.UI_HIDE);
        // }));

        //音效
        Audio.AudioPlayer.getInst().init();
        Audio.AudioPlayer.getInst().play_music(Audio.AUDIO_CONFIG.Audio_Bgm);
        event_mgr.get_inst().add(Event_Name.MUTE_MUSIC, this.onMuteMusic, this);
        event_mgr.get_inst().add(Event_Name.UNMUTE_MUSIC, this.onUnmuteMusic, this);

        //初始化连接url
        network.socket_client.setServerURL(Consts.ServerURL);
        //初始化
        this.Init();
    }

    onDestroy()
    {
        console.log("app退出，清除登录状态");
    }

    Init()
    {

    }

    update(dt:number)
    {
        TimerMgr.getInst().update(dt);
    }

    onMuteMusic()
    {
        Audio.AudioPlayer.getInst().set_music_mute(true);
    }

    onUnmuteMusic()
    {
        Audio.AudioPlayer.getInst().set_music_mute(false);
    }
}