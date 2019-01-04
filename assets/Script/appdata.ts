import * as Consts from "./consts"
import {event_mgr, Event_Name} from "./common/event/event_mgr"

//用户数据
class UserInfo
{
    public nickName:string;
    public avatarUrl:string;

    constructor()
    {
        this.nickName = "";
        this.avatarUrl = "";
    }

    get avatarUrl132():string
    {
        return this.avatarUrl.substr(0, this.avatarUrl.lastIndexOf('/')) + "/132";
    }
}

//自定义用户数据


class AppData
{
    private _wxUserInfo:UserInfo;

    constructor()
    {
        this._wxUserInfo = new UserInfo();
    }

    get wxUserInfo()
    {
        return this._wxUserInfo;
    }

    set UserInfo(value:UserInfo)
    {
        const info = this._wxUserInfo;
        info.nickName = value.nickName;
        info.avatarUrl = value.avatarUrl;
    }
}

export const appdata = new AppData();