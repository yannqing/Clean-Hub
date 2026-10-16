package net.nyx.printerservice.print;

import android.os.Parcel;
import android.os.Parcelable;

/**
 * Parcelable contract supplied by the POS-T1101 printer SDK.
 *
 * Keep the field order and parcel layout aligned with the vendor service. The
 * service lives in another Android package and unmarshals this exact shape.
 */
public class PrintTextFormat implements Parcelable {

    private int textSize = 24;
    private boolean underline = false;
    private float textScaleX = 1.0f;
    private float textScaleY = 1.0f;
    private float letterSpacing = 0;
    private float lineSpacing = 0;
    private int topPadding = 0;
    private int leftPadding = 0;
    private int ali = 0;
    private int style = 0;
    private int font = 0;
    private String path;

    public PrintTextFormat() {}

    public void setTextSize(int textSize) {
        this.textSize = textSize;
    }

    public void setUnderline(boolean underline) {
        this.underline = underline;
    }

    public void setTextScaleX(float textScaleX) {
        this.textScaleX = textScaleX;
    }

    public void setTextScaleY(float textScaleY) {
        this.textScaleY = textScaleY;
    }

    public void setLetterSpacing(float letterSpacing) {
        this.letterSpacing = letterSpacing;
    }

    public void setLineSpacing(float lineSpacing) {
        this.lineSpacing = lineSpacing;
    }

    public void setTopPadding(int topPadding) {
        this.topPadding = topPadding;
    }

    public void setLeftPadding(int leftPadding) {
        this.leftPadding = leftPadding;
    }

    public void setAli(int ali) {
        this.ali = ali;
    }

    public void setStyle(int style) {
        this.style = style;
    }

    public void setFont(int font) {
        this.font = font;
    }

    public void setPath(String path) {
        this.path = path;
    }

    protected PrintTextFormat(Parcel in) {
        textSize = in.readInt();
        underline = in.readByte() != 0;
        textScaleX = in.readFloat();
        textScaleY = in.readFloat();
        letterSpacing = in.readFloat();
        lineSpacing = in.readFloat();
        topPadding = in.readInt();
        leftPadding = in.readInt();
        ali = in.readInt();
        style = in.readInt();
        font = in.readInt();
        path = in.readString();
    }

    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeInt(textSize);
        dest.writeByte((byte) (underline ? 1 : 0));
        dest.writeFloat(textScaleX);
        dest.writeFloat(textScaleY);
        dest.writeFloat(letterSpacing);
        dest.writeFloat(lineSpacing);
        dest.writeInt(topPadding);
        dest.writeInt(leftPadding);
        dest.writeInt(ali);
        dest.writeInt(style);
        dest.writeInt(font);
        dest.writeString(path);
    }

    @Override
    public int describeContents() {
        return 0;
    }

    public static final Creator<PrintTextFormat> CREATOR = new Creator<>() {
        @Override
        public PrintTextFormat createFromParcel(Parcel in) {
            return new PrintTextFormat(in);
        }

        @Override
        public PrintTextFormat[] newArray(int size) {
            return new PrintTextFormat[size];
        }
    };
}
