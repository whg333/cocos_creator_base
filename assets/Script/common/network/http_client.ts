import * as utils from "../util"
import * as Consts from "../../consts"
import { pop_mgr, UI_CONFIG } from "../ui/pop_mgr";

const HTTP_METHOD_GET:string = "GET";
const HTTP_METHOD_POST:string = "POST";
const TIME_OUT:number = 5000;
const MAX_RETRY_TIMES = 3;

export const RequestAction = {
    Login:"login",
    User:"user",
    Hello:"Hello"
 };

const enum ResponseCode{
	ECodeSuccess       = 0,  // 成功
	ECodeError         = 1, // 通用错误
	ECodeServerError   = 2,  // 服务器内部数据错误
	ECodeNotLogin      = 10, // 未登录
	ECodeWrongParam    = 11, // 错误的参数
    ECodeNoEnoughMoney = 12, // 钱不够
    ECodeShareSameGroup = 13,   //分享到相同的群
}

enum READY_STATE
{
    UNSENT = 0,             //未打开,open()方法还未被调用.
    OPENED = 1,             //未发送,send()方法还未被调用.
    HEADERS_RECEIVED = 2,   //已获取响应头,send()方法已经被调用, 响应头和响应状态已经返回.
    LOADING = 3,            //正在下载响应体,响应体下载中; responseText中已经获取了部分数据.
    DONE = 4,               //请求完成,整个请求过程已经完毕.	
}

function status_is_ok(status:number):boolean
{
    return status >= 200 && status < 300;
}

function join_params(params:any):string
{
    let query_str:string = '';
    for(let key in params)
    {
        if(query_str != '')
        {
            query_str += '&';
        }
        params[key] = params[key].toString();
        query_str += key + '=' + params[key];
    }
    // return encodeURIComponent(query_str);
    return query_str
}

class http_request
{
    url:string;
    full_url:string;
    method:string;
    params:any;
    timeout?:number;
    retry_times:number;
    cb?:utils.handler;
    xhr:XMLHttpRequest;
    constructor(url:string, method:string, params:any, cb?:utils.handler, timeout?:number)
    {
        this.full_url = this.url = url;
        this.method = method;
        this.timeout = timeout || TIME_OUT;
        this.cb = cb;
        this.retry_times = 0;
        if(typeof(params) === "object")
        {
            this.params = join_params(params);
        }
        else
        {
            this.params = params;
        }
    }
    toString():String
    {
        return "http_request:" + this.full_url + ",method=" + this.method + ",timeout=" + this.timeout;
    }
    exec()
    {
        let _xhr:XMLHttpRequest = this.xhr;
        let data:any = null;
        if(!_xhr)
        {
            this.xhr = _xhr = new XMLHttpRequest();
        }
        if(this.method == HTTP_METHOD_POST)
        {
            data = this.params;
        }
        else
        {
            this.full_url = this.full_url + '?' + this.params;
        }

        let self:http_request = this;
        _xhr.onreadystatechange = function():void 
        {
            if (_xhr.readyState === READY_STATE.DONE)
            {
                let status:number = _xhr.status;
                if(!status_is_ok(status))
                {
                    cc.warn(self.toString(), "resp error, status code=", status); 
                    return;
                }
                cc.info(self.toString(), "resp success! status code=", status, ",responseType=", _xhr.responseType, ",response=", _xhr.responseText);
                let resp = JSON.parse(_xhr.responseText);                                                                                                                                                                               //{rescode, resmsg, respbody}
                let success:boolean = resp.code === 0;
                if(self.cb)
                {
                    self.cb.exec(success, resp);
                }
            }
        };
        _xhr.ontimeout = function():void
        {
            cc.warn(self.toString(), "request ontimeout");
        }
        _xhr.onerror = function():void
        {
            cc.error(self.toString(), "request onerror")
        }
        _xhr.onabort = function():void
        {
            cc.warn(self.toString(), "request onabort")
        }
        
        console.log(this.full_url)
        _xhr.open(this.method, this.full_url, true);
        //setRequestHeader should be called after open
        if (cc.sys.isMobile)
        {
            _xhr.setRequestHeader("Accept-Encoding", "gzip,deflate");
        }
        if(this.method == HTTP_METHOD_POST)
        {
            // _xhr.setRequestHeader("Content-Type","text/plain;charset=UTF-8");
            _xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded;charset=UTF-8");
        }

        // note: In Internet Explorer, the timeout property may be set only after calling the open()  
        // method and before calling the send() method.  
        _xhr.timeout = this.timeout || TIME_OUT;
        //event binding should before send
        _xhr.send(data);
    }
}

type proto_listener = {
    cb:utils.handler;
    cx:cc.Component;
}

//todo:http_request对象池重用，http_client监听http_request对象事件, 统计request数量, 统一的http_error_handler处理
export default class http_client
{
    private static inst:http_client;
    private error_handler:utils.handler;
    private proto_listeners:Map<string, proto_listener[]>;
    private context_protos:Map<cc.Component, string[]>;

    private constructor()
    {
        this.proto_listeners = new Map();
        this.context_protos = new Map();
        this.error_handler = utils.gen_handler(this.handle_response_error, this);
    }

    static get_inst():http_client
    {
        if(!this.inst)
        {
            this.inst = new http_client();
        }
        return this.inst;
    }
    
    private register_listener(proto_name:string, cb:utils.handler, context:cc.Component)
    {
        //proto_name->listeners
        let listeners:proto_listener[] = this.proto_listeners.get(proto_name);
        if(!listeners)
        {
            listeners = [];
            this.proto_listeners.set(proto_name, listeners);
        }
        //持久化handler
        listeners.push({cb:cb, cx:context})

        //context->proto_names
        let protos:string[] = this.context_protos.get(context);
        if(!protos)
        {
            protos = [];
            this.context_protos.set(context, protos);
        }
        protos.push(proto_name);
    }

    private unregister_listeners(context:cc.Component)
    {
        let protos:string[] = this.context_protos.get(context);
        if(!protos)
        {
            cc.info(context.name, "has no protos");
            return;
        }
        protos.forEach((proto_name:string):void=>{
            let listeners:proto_listener[] = this.proto_listeners.get(proto_name);
            if(!listeners)
            {
                return;
            }
            for(let i:number = listeners.length - 1; i >= 0; i--)
            {
                if(listeners[i].cx === context)
                {
                    //释放handler
                    listeners.splice(i, 1);
                    cc.info(context.name, "remove listener");
                }
            }
        });
        this.context_protos.delete(context);
    }

    private unregister_all()
    {
        this.context_protos.forEach((value, key) => {
            this.unregister_listeners(key);
        });
    }

    private handle_http_response(proto_name:string, req_data:any, is_ok:boolean, resp:any)
    {
        cc.info("handle_http_response", proto_name);
        if(!is_ok)
        {
            this.error_handler.exec(resp.code, resp.errmsg);
            // if(resp.rescode == 4)
            // {
            //     //跳到登录页
            //     pop_mgr.get_inst().clear();
            //     return;
            // }
        }
        let listeners:proto_listener[] = this.proto_listeners.get(proto_name);
        if(!listeners)
        {
            return;
        }
        listeners.forEach((listener:proto_listener, index:number):void=>{
            if(!cc.isValid(listener.cx))
            {
                return;
            }
            listener.cb.exec(is_ok, resp.data, req_data);
        });
    }

    private handle_response_error(rescode:number, resmsg:string)
    {
        // toast.show(consts.MSG_ERROR[rescode] || resmsg);
        console.log(`请求响应失败, code=${rescode}`, resmsg);
        //需要重新登录, 跳到登录页
        if(rescode == ResponseCode.ECodeNotLogin)
        {
            //跳到登录页
            pop_mgr.get_inst().clear();
        }
    }

    private spawn_request(url:string, action:string, req_data:any, method:string, params:any, timeout?:number):http_request
    {
        let cb:utils.handler = utils.gen_handler(this.handle_http_response, this, action, req_data);
        return new http_request(url + "/" + action, method, params, cb, timeout);
    }
    
    private request(action:string, params:any, req_data?:any, method:string = HTTP_METHOD_GET, timeout?:number):void
    {
        let req:http_request = this.spawn_request(Consts.ServerURL, action, req_data, method, params, timeout);
        req.exec();
    }

    private register_error_handler(cb:utils.handler)
    {
        this.error_handler = cb;
    }

    static request(action:string, params?:any, req_data?:any, method:string = HTTP_METHOD_POST, timeout?:number):void
    {
        http_client.get_inst().request(action, params, req_data, method, timeout);
    }

    static register_listener(proto_name:string, cb:utils.handler, context:cc.Component)
    {
        http_client.get_inst().register_listener(proto_name, cb, context);
    }

    static unregister_listeners(context:cc.Component)
    {
        http_client.get_inst().unregister_listeners(context);
    }

    static unregister_all()
    {
        http_client.get_inst().unregister_all();
    }

    static register_error_handler(cb:utils.handler)
    {
        http_client.get_inst().register_error_handler(cb);
    }
}