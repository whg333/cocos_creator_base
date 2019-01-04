import * as utils from "../util"
import { pop_mgr, UI_CONFIG } from "../ui/pop_mgr";

export const SocketAction = {
    Login:"login",
    User:"user",
 };

 type action_listener = {
    cb:utils.handler;
    cx:cc.Component;
};

class WebSocketClient
{
    private serverURL:string;
    private error_handler:utils.handler;
    private action_listeners:Map<string, action_listener[]>;
    private ctx_action:Map<cc.Component, string[]>;
    private ws:WebSocket;
    public is_connected:boolean;
    private is_connecting:boolean;
    private connected_cb:utils.handler;
    public reconnected_times:number;

    constructor()
    {
        this.serverURL = "";
        this.error_handler = utils.gen_handler(this.handle_response_error, this);
        this.action_listeners = new Map();
        this.ctx_action = new Map();
        this.reconnected_times = 0;
    }

    setServerURL(url:string)
    {
        this.serverURL = url;
    }

    send(action:string, req_data?:any)
    {
        if(!this.is_connected)
        {
            cc.warn("socket is not connected, readyState=", this.ws.readyState);
            if(this.reconnected_times >= 3)
            {
                this.connect(this.connected_cb);
            }
            return;
        }

        const datas = req_data ? {[action]:req_data} : action;
        this.ws.send(JSON.stringify(datas));
        cc.info("socket send", action, req_data);
    }

    sendtest()
    {
        this.ws.send(JSON.stringify({Hello: {
            Name: 'leaf'
        }}))
    }


    connect(cb?:utils.handler)
    {
        if(this.is_connected)
        {
            cc.info("socket is alreay connected");
            cb && cb.exec();
            return;
        }

        if(this.is_connecting)
        {
            cc.info("socket is connecting");
            return;
        }
        this.is_connecting = true;
        this.connected_cb = cb;

        this.ws = new WebSocket(this.serverURL);
        this.ws.binaryType = "arraybuffer";
        this.ws.onopen = this.on_ws_open.bind(this);
        this.ws.onerror = this.on_ws_error.bind(this);
        this.ws.onmessage = this.on_ws_message.bind(this);
        this.ws.onclose = this.on_ws_close.bind(this);
    }

    dis_connect()
    {
        if(!this.is_connected)
        {
            return;
        }
        //调用close方法会触发on_ws_close
        this.ws.close();
    }

    private on_ws_open(event:Event):any
    {
        cc.info("socket connected, addr=", this.serverURL);
        this.is_connected = true;
        if(this.connected_cb)
        {
            this.connected_cb.exec();
        }
    }

    private on_ws_error(event:Event):any
    {
        cc.info("socket error", event);
        // toast.show("网络连接异常，请稍后重试");
    }

    private on_ws_close(event:CloseEvent):any
    {
        //code定义见https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
        cc.info("socket closed, code=", event.code);
        this.is_connected = false;
        this.is_connecting = false;
        pop_mgr.get_inst().clear();
        if(this.reconnected_times >= 3)
        {
            console.log("网络重连失败！");
            return;
        }
        this.connect(this.connected_cb);
        this.reconnected_times += 1;
        console.log(`网络连接断开，第${this.reconnected_times}次重连`);
    }

    private on_ws_message(event:MessageEvent):any
    {
        //二进制数据解析
        // let decoder = new TextDecoder('utf-8')
        // const eventData = decoder.decode(event.data)
        // const datas = JSON.parse(eventData) || eventData;
        const datas = JSON.parse(event.data) || event.data;

        let action:string;
        for(let key in datas)
        {
            action = key;
        }
        this.handle_response(action, datas[action]);
    }

    private handle_response(action:string, msg)
    {
        cc.info("handle_response", msg);
        let is_ok:boolean = msg.code == 0;
        if(!is_ok)
        {
            this.error_handler.exec(msg.code, msg.errmsg);
        }

        //执行协议回调
        let listeners:action_listener[] = this.action_listeners.get(action);
        if(!listeners)
        {
            return;
        }
        let req_data:any[];

        listeners.forEach((listener:action_listener, index:number):void=>{
            if(!cc.isValid(listener.cx))
            {
                return;
            }
            if(req_data)
            {
                listener.cb.exec(is_ok, msg, ...req_data);
            }
            else
            {
                listener.cb.exec(is_ok, msg.data);
            }
        });
    }

    private handle_response_error(code:number, errmsg:string)
    {
        console.log(code, errmsg);
    }

    register_listener(action:string, cb:utils.handler, ctx:cc.Component)
    {
        //cmd->listeners
        let listeners:action_listener[] = this.action_listeners.get(action);
        if(!listeners)
        {
            listeners = [];
            this.action_listeners.set(action, listeners);
        }

        listeners.push({cb:cb, cx:ctx})

        //ctx->action
        let actions:string[] = this.ctx_action.get(ctx);
        if(!actions)
        {
            actions = [];
            this.ctx_action.set(ctx, actions);
        }
        actions.push(action);
    }

    unregister_listeners(ctx:cc.Component)
    {
        let actions:string[] = this.ctx_action.get(ctx);
        if(!actions)
        {
            cc.info(ctx.name, "has no actions");
            return;
        }
        actions.forEach((action:string):void=>{
            let listeners:action_listener[] = this.action_listeners.get(action);
            if(!listeners)
            {
                return;
            }
            for(let i:number = listeners.length - 1; i >= 0; i--)
            {
                if(listeners[i].cx === ctx)
                {
                    //释放handler
                    listeners.splice(i, 1);
                    cc.info(ctx.name, "remove listener");
                }
            }
        });
        this.ctx_action.delete(ctx);
    }

    unregister_all()
    {
        this.ctx_action.forEach((value, key) => {
            this.unregister_listeners(key);
        });
    }

    register_error_handler(cb:utils.handler)
    {
        this.error_handler = cb;
    }
}

export const socket_client:WebSocketClient = new WebSocketClient();
